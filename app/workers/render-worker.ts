import { bundledLanguages, createHighlighter } from 'shiki/bundle/web';

type RenderRequest = {
  id: string;
  code: string;
  patch?: string;
  after?: string;
  lang: string;
  theme: string;
  gutterMode?: 'none' | 'single' | 'double';
  gutterLines?: string[];
  grepPattern?: string;
};

type RenderResponse =
  | { id: string; ok: true; html: string }
  | { id: string; ok: false; error: string };

type DiffRow = {
  html: string;
  rowClass?: string;
};

let highlighterPromise: Promise<Awaited<ReturnType<typeof createHighlighter>>> | null = null;
let cachedTheme = '';
let loadedLanguageCache = new Set<string>(['text']);
let failedLanguageCache = new Set<string>();

function getHighlighter(theme: string) {
  if (!highlighterPromise || cachedTheme !== theme) {
    cachedTheme = theme;
    highlighterPromise = createHighlighter({ themes: [theme], langs: ['text'] });
    loadedLanguageCache = new Set(['text']);
    failedLanguageCache = new Set();
  }
  return highlighterPromise;
}

function languageCandidates(lang: string) {
  const trimmed = (lang || '').trim().toLowerCase();
  if (!trimmed) return ['text'];
  if (trimmed === 'shellscript') return ['bash', 'shellscript', 'sh', 'text'];
  if (trimmed === 'tsx') return ['tsx', 'typescript', 'text'];
  if (trimmed === 'jsx') return ['jsx', 'javascript', 'text'];
  if (trimmed === 'md') return ['markdown', 'text'];
  if (trimmed === 'yml') return ['yaml', 'text'];
  return [trimmed, 'text'];
}

async function resolveLanguage(highlighter: Awaited<ReturnType<typeof createHighlighter>>, lang: string) {
  const loaded =
    typeof highlighter.getLoadedLanguages === 'function' ? highlighter.getLoadedLanguages() : [];
  loaded.forEach((item) => loadedLanguageCache.add(item));
  for (const candidate of languageCandidates(lang)) {
    if (loadedLanguageCache.has(candidate)) return candidate;
    if (candidate === 'text') return 'text';
    const loadedCandidate = await tryLoadLanguage(highlighter, candidate);
    if (loadedCandidate) return candidate;
  }
  return 'text';
}

type LanguageLoader = () => Promise<{ default: unknown }>;

async function tryLoadLanguage(
  highlighter: Awaited<ReturnType<typeof createHighlighter>>,
  candidate: string,
) {
  if (failedLanguageCache.has(candidate)) return false;
  if (typeof highlighter.loadLanguage !== 'function') return false;

  const loader = (bundledLanguages as Record<string, unknown>)[candidate];
  try {
    if (typeof loader === 'function') {
      const module = await (loader as LanguageLoader)();
      const language = module?.default;
      await highlighter.loadLanguage(language as never);
    } else {
      await highlighter.loadLanguage(candidate as never);
    }
    loadedLanguageCache.add(candidate);
    failedLanguageCache.delete(candidate);
    return true;
  } catch (error) {
    if (!failedLanguageCache.has(candidate)) {
      console.warn('[render-worker] language load failed', candidate, error);
    }
    failedLanguageCache.add(candidate);
    return false;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlFromRows(rows: string) {
  return `<div class="code-host"><pre class="shiki"><code>${rows}</code></pre></div>`;
}

function buildCodeRows(lines: string[], mode: 'none' | 'single' | 'double', gutterLines?: string[]) {
  return lines
    .map((line, index) => {
      if (mode === 'none') {
        return `<span class="code-row">${line}</span>`;
      }
      if (mode === 'double') {
        const pair = gutterLines?.[index]?.split('\t') ?? [];
        const left = pair[0] ?? String(index + 1);
        const right = pair[1] ?? '';
        return `<span class="code-row"><span class="code-gutter">${escapeHtml(left)}</span><span class="code-gutter">${escapeHtml(right)}</span>${line}</span>`;
      }
      const gutter = gutterLines?.[index] ?? String(index + 1);
      return `<span class="code-row file-row"><span class="code-gutter span-2">${escapeHtml(gutter)}</span>${line}</span>`;
    })
    .join('\n');
}

function applyPatchToCode(code: string, patch: string) {
  const lines = code.split('\n');
  let offset = 0;
  const patchLines = patch.split('\n');
  let index = 0;
  while (index < patchLines.length) {
    const line = patchLines[index];
    if (!line.startsWith('@@')) {
      index += 1;
      continue;
    }
    const match = /@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(line);
    if (!match) {
      index += 1;
      continue;
    }
    const oldLine = Number(match[1]);
    let pointer = oldLine - 1 + offset;
    index += 1;
    while (index < patchLines.length && !patchLines[index].startsWith('@@')) {
      const patchLine = patchLines[index];
      if (patchLine.startsWith('+') && !patchLine.startsWith('+++')) {
        lines.splice(pointer, 0, patchLine.slice(1));
        pointer += 1;
        offset += 1;
      } else if (patchLine.startsWith('-') && !patchLine.startsWith('---')) {
        lines.splice(pointer, 1);
        offset -= 1;
      } else if (patchLine.startsWith(' ')) {
        pointer += 1;
      }
      index += 1;
    }
  }
  return lines.join('\n');
}

function extractShikiLines(html: string) {
  const lines = html.split('\n').filter((line) => line.includes('class="line"'));
  return lines.map((line, index) => {
    let next = line;
    if (index === 0) {
      next = next.replace(/^.*?(<span class="line">)/, '$1');
    }
    if (index === lines.length - 1) {
      next = next.replace(/<\/code><\/pre>\s*$/, '');
    }
    return next;
  });
}

function buildDiffGutterLines(source: string) {
  const lines = source.split('\n');
  let oldLine = 0;
  let newLine = 0;
  const oldValues: Array<string> = [];
  const newValues: Array<string> = [];

  lines.forEach((line) => {
    if (line.startsWith('@@')) {
      const match = /@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/.exec(line);
      if (match) {
        oldLine = Number(match[1]);
        newLine = Number(match[2]);
      }
      oldValues.push('');
      newValues.push('');
      return;
    }
    if (
      line.startsWith('diff ') ||
      line.startsWith('index ') ||
      line.startsWith('---') ||
      line.startsWith('+++') ||
      line.startsWith('***')
    ) {
      oldValues.push('');
      newValues.push('');
      return;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      oldValues.push('');
      newValues.push(String(newLine));
      newLine += 1;
      return;
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      oldValues.push(String(oldLine));
      newValues.push('');
      oldLine += 1;
      return;
    }
    if (oldLine === 0 && newLine === 0) {
      oldValues.push('');
      newValues.push('');
      return;
    }
    oldValues.push(String(oldLine));
    newValues.push(String(newLine));
    oldLine += 1;
    newLine += 1;
  });

  return { oldValues, newValues };
}

function wrapDiffRows(
  lines: DiffRow[],
  oldValues: string[],
  newValues: string[],
  mode: 'none' | 'single' | 'double',
) {
  return lines
    .map((row, index) => {
      const rowClass = row.rowClass ? ` code-row ${row.rowClass}` : ' code-row';
      if (mode === 'none') return `<span class="${rowClass.trim()}">${row.html}</span>`;
      if (mode === 'single') {
        const left = oldValues[index] ?? '';
        const right = newValues[index] ?? '';
        const gutter = right || left;
        return `<span class="${rowClass.trim()}"><span class="code-gutter span-2">${escapeHtml(gutter)}</span>${row.html}</span>`;
      }
      const oldValue = oldValues[index] ?? '';
      const newValue = newValues[index] ?? '';
      return `<span class="${rowClass.trim()}"><span class="code-gutter">${escapeHtml(oldValue)}</span><span class="code-gutter">${escapeHtml(newValue)}</span>${row.html}</span>`;
    })
    .join('\n');
}

function buildGrepMatcher(pattern?: string) {
  if (!pattern?.trim()) return null;
  try {
    return new RegExp(pattern, 'g');
  } catch {
    return null;
  }
}

function highlightGrepMatches(line: string, matcher: RegExp | null) {
  if (!matcher) return escapeHtml(line);
  matcher.lastIndex = 0;
  let html = '';
  let cursor = 0;
  while (cursor <= line.length) {
    const match = matcher.exec(line);
    if (!match) break;
    const index = match.index;
    const value = match[0] ?? '';
    if (index > cursor) {
      html += escapeHtml(line.slice(cursor, index));
    }
    if (!value) {
      if (index >= line.length) break;
      html += escapeHtml(line[index] ?? '');
      cursor = index + 1;
      matcher.lastIndex = cursor;
      continue;
    }
    html += `<span class="grep-match"><strong>${escapeHtml(value)}</strong></span>`;
    cursor = index + value.length;
    if (!matcher.global) break;
    if (matcher.lastIndex <= index) matcher.lastIndex = index + value.length;
  }
  if (cursor < line.length) html += escapeHtml(line.slice(cursor));
  return html;
}

function renderGrepRows(
  code: string,
  mode: 'none' | 'single' | 'double',
  gutterLines?: string[],
  pattern?: string,
) {
  const lines = code.split('\n');
  const matcher = buildGrepMatcher(pattern);
  return lines
    .map((line, index) => {
      const content = `<span class="line">${highlightGrepMatches(line, matcher)}</span>`;
      if (mode === 'none') return `<span class="code-row">${content}</span>`;
      if (mode === 'double') {
        const pair = gutterLines?.[index]?.split('\t') ?? [];
        const left = pair[0] ?? '';
        const right = pair[1] ?? '';
        return `<span class="code-row"><span class="code-gutter">${escapeHtml(left)}</span><span class="code-gutter">${escapeHtml(right)}</span>${content}</span>`;
      }
      const gutter = gutterLines?.[index] ?? String(index + 1);
      return `<span class="code-row"><span class="code-gutter span-2">${escapeHtml(gutter)}</span>${content}</span>`;
    })
    .join('\n');
}

function buildDiffHtmlFromCode(
  before: string,
  after: string,
  diff: string,
  lang: string,
  theme: string,
  mode: 'none' | 'single' | 'double',
) {
  return getHighlighter(theme).then(async (highlighter) => {
    const resolvedLang = await resolveLanguage(highlighter, lang);
    const beforeHtml = highlighter.codeToHtml(before, { lang: resolvedLang, theme });
    const afterHtml = highlighter.codeToHtml(after, { lang: resolvedLang, theme });
    const beforeLines = extractShikiLines(beforeHtml);
    const afterLines = extractShikiLines(afterHtml);
    const diffLines = diff.split('\n');
    let oldLine = 0;
    let newLine = 0;
    const output: DiffRow[] = [];
    diffLines.forEach((line) => {
      if (line.startsWith('@@')) {
        const match = /@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/.exec(line);
        if (match) {
          oldLine = Number(match[1]);
          newLine = Number(match[2]);
        }
        output.push({ html: `<span class="line">${escapeHtml(line)}</span>`, rowClass: 'line-hunk' });
        return;
      }
      if (
        line.startsWith('diff ') ||
        line.startsWith('index ') ||
        line.startsWith('---') ||
        line.startsWith('+++') ||
        line.startsWith('***')
      ) {
        output.push({ html: `<span class="line">${escapeHtml(line)}</span>`, rowClass: 'line-header' });
        return;
      }
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const htmlLine = afterLines[newLine - 1] ?? `<span class="line">${escapeHtml(line.slice(1))}</span>`;
        output.push({ html: htmlLine, rowClass: 'line-added' });
        newLine += 1;
        return;
      }
      if (line.startsWith('-') && !line.startsWith('---')) {
        const htmlLine = beforeLines[oldLine - 1] ?? `<span class="line">${escapeHtml(line.slice(1))}</span>`;
        output.push({ html: htmlLine, rowClass: 'line-removed' });
        oldLine += 1;
        return;
      }
      const htmlLine = beforeLines[oldLine - 1] ?? `<span class="line">${escapeHtml(line.replace(/^ /, ''))}</span>`;
      output.push({ html: htmlLine });
      oldLine += 1;
      newLine += 1;
    });
    const { oldValues, newValues } = buildDiffGutterLines(diff);
    const rows = wrapDiffRows(output, oldValues, newValues, mode);
    return buildHtmlFromRows(rows);
  });
}

async function renderCodeHtml(request: RenderRequest) {
  const highlighter = await getHighlighter(request.theme);
  const resolvedLang = await resolveLanguage(highlighter, request.lang);
  const html = highlighter.codeToHtml(request.code, { lang: resolvedLang, theme: request.theme });
  const lines = extractShikiLines(html);
  const mode = request.gutterMode ?? 'single';
  return buildHtmlFromRows(buildCodeRows(lines, mode, request.gutterLines));
}

function renderRequest(request: RenderRequest): Promise<string> {
  if (request.patch) {
    const after = request.after ?? applyPatchToCode(request.code, request.patch);
    return buildDiffHtmlFromCode(
      request.code,
      after,
      request.patch,
      request.lang,
      request.theme,
      request.gutterMode ?? 'double',
    );
  }

  if (request.grepPattern !== undefined) {
    const mode = request.gutterMode ?? 'single';
    const rows = renderGrepRows(request.code, mode, request.gutterLines, request.grepPattern);
    return Promise.resolve(buildHtmlFromRows(rows));
  }

  return renderCodeHtml(request);
}

self.onmessage = (event: MessageEvent<RenderRequest>) => {
  const request = event.data;
  renderRequest(request)
    .then((html) => {
      const response: RenderResponse = { id: request.id, ok: true, html };
      self.postMessage(response);
    })
    .catch((error) => {
      const response: RenderResponse = {
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
      self.postMessage(response);
    });
};
