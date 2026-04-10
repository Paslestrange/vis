import type { Ref } from 'vue';
import ContentViewer from '../components/viewers/ContentViewer.vue';
import GlobContent from '../components/ToolWindow/Glob.vue';
import GrepContent from '../components/ToolWindow/Grep.vue';
import McpContent from '../components/ToolWindow/Mcp.vue';
import ReasoningContent from '../components/ToolWindow/Reasoning.vue';
import ThreadHistoryContent from '../components/ThreadHistoryContent.vue';
import WebContent from '../components/ToolWindow/Web.vue';
import {
  formatGlobToolTitle,
  formatListToolTitle,
  formatWebfetchToolTitle,
  formatQueryToolTitle,
  guessLanguageFromPath,
  resolveReadWritePath,
  resolveReadRange,
  toolColor,
} from '../components/ToolWindow/utils';
import type { useFloatingWindows } from './useFloatingWindows';
import type { MessagePart, ReasoningPart, ToolPart } from '../types/sse';
import type { QuestionInfo } from './useQuestions';
import type { FileNode } from './useFileTree';
import { renderWorkerHtml } from '../utils/workerRenderer';
import {
  extractFileRead as extractToolFileRead,
  extractPatch as extractToolPatch,
} from '../utils/toolRenderers';
import { splitFileContentDirectoryAndPath } from '../utils/path';
import * as opencodeApi from '../utils/opencode';
import { getCanvasMetrics, getFileViewerPosition } from '../utils/floatingWindowGeometry';

type FloatingWindowManager = ReturnType<typeof useFloatingWindows>;

export type ThreadHistoryEntry =
  | { key: string; kind: 'message'; content: string; time: number; agent?: string }
  | { key: string; kind: 'tool'; part: ToolPart; time: number }
  | { key: string; kind: 'reasoning'; part: ReasoningPart; time: number }
  | {
      key: string;
      kind: 'question';
      questions: QuestionInfo[];
      status: 'pending' | 'replied' | 'rejected';
      answers?: string[][];
      time: number;
    };

export type FileContentResponse = {
  content?: string;
  encoding?: string;
  type?: 'text' | 'binary';
};

const TOOL_RENDERER_READ_EVENT_TYPES = new Set(['session.diff', 'file.edited']);
const TOOL_RENDERER_WRITE_EVENT_TYPES = new Set<string>([]);
const TOOL_RENDERER_MESSAGE_EVENTS = new Set([
  'message.updated',
  'message.part.updated',
  'message.removed',
  'message.part.removed',
]);

const toolRendererReadTypesKey = `FILE_${'READ'}_EVENT_TYPES`;
const toolRendererWriteTypesKey = `FILE_${'WRITE'}_EVENT_TYPES`;
const toolRendererMessageTypesKey = `MESSAGE_${'EVENT_TYPES'}`;

const TOOL_WINDOW_HIDDEN = new Set([
  'question',
  'todoread',
  'todowrite',
  'lsp',
  'plan_enter',
  'plan_exit',
  'task',
]);
const TOOL_WINDOW_SUPPORTED = new Set([
  'apply_patch',
  'bash',
  'codesearch',
  'edit',
  'glob',
  'grep',
  'list',
  'mcp',
  'multiedit',
  'read',
  'task',
  'webfetch',
  'websearch',
  'write',
]);

function toUint8ArrayFromBase64(input: string) {
  const decoded = atob(input);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
}

export function decodeApiTextContent(data: FileContentResponse) {
  const encoding = typeof data?.encoding === 'string' ? data.encoding : 'utf-8';
  const content = typeof data?.content === 'string' ? data.content : '';
  if (!content) return '';
  if (encoding !== 'base64') return content;
  const bytes = toUint8ArrayFromBase64(content);
  try {
    return new TextDecoder().decode(bytes);
  } catch {
    return atob(content);
  }
}

export function useToolWindows(
  fw: FloatingWindowManager,
  deps: {
    activeDirectory: Ref<string>;
    shikiTheme: Ref<string>;
  },
) {
  const { activeDirectory, shikiTheme } = deps;

  function formatToolValue(value: unknown) {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function parseToolOutputText(output: unknown) {
    if (output === undefined) return undefined;
    if (typeof output === 'string') return output;
    if (output && typeof output === 'object') {
      const outputRecord = output as Record<string, unknown>;
      const outputContent =
        (outputRecord.content as string | undefined) ??
        (outputRecord.text as string | undefined) ??
        (outputRecord.body as string | undefined) ??
        (outputRecord.result as string | undefined);
      if (typeof outputContent === 'string') return outputContent;
      const stdout = outputRecord.stdout;
      const stderr = outputRecord.stderr;
      const parts: string[] = [];
      if (typeof stdout === 'string' && stdout.length > 0) parts.push(stdout);
      if (typeof stderr === 'string' && stderr.length > 0) parts.push(stderr);
      if (parts.length > 0) return parts.join('\n');
    }
    return formatToolValue(output);
  }

  function formatTaskToolOutput(value: string) {
    return value
      .split('\n')
      .filter((line) => !/^task_id:\s*/i.test(line.trim()))
      .join('\n')
      .replace(/<\/?task_result>/gi, '')
      .trim();
  }

  async function renderReadHtmlFromApi(params: {
    callId?: string;
    path?: string;
    lang: string;
    lineOffset?: number;
    lineLimit?: number;
    fallbackText?: string;
  }): Promise<string> {
    const renderText = (text: string, gutterMode: 'none' | 'single' = 'none') =>
      renderWorkerHtml({
        id: `read-${params.callId ?? 'unknown'}-${Date.now().toString(36)}`,
        code: text,
        lang: 'text',
        theme: 'github-dark',
        gutterMode,
      });

    const directory = activeDirectory.value.trim();
    if (!directory) return renderText('No active directory selected for READ window.');
    if (!params.path) return renderText('READ path is missing in tool payload.');

    const requestPath = splitFileContentDirectoryAndPath(params.path, directory);

    try {
      const listData = await opencodeApi.listFiles({
        directory: requestPath.directory,
        path: requestPath.path,
      });
      if (Array.isArray(listData) && listData.length > 0) {
        const entries = listData
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const record = item as FileNode;
            const name = record.name ?? record.path?.split('/').pop();
            if (!name) return null;
            return record.type === 'directory' ? `${name}/` : name;
          })
          .filter((entry): entry is string => Boolean(entry));
        const code = entries.length > 0 ? entries.join('\n') : '(empty directory)';
        return renderText(code, 'none');
      }
    } catch {}

    try {
      const data = (await opencodeApi.readFileContent({
        directory: requestPath.directory,
        path: requestPath.path,
      })) as FileContentResponse;
      const type = data?.type === 'binary' ? 'binary' : 'text';

      if (type === 'binary') {
        return renderText(`Binary file: ${params.path}\nPreview is not available.`, 'none');
      }

      const code = decodeApiTextContent(data);
      return renderWorkerHtml({
        id: `read-${params.callId ?? 'unknown'}-${Date.now().toString(36)}`,
        code,
        lang: params.lang,
        theme: 'github-dark',
        gutterMode: 'single',
        lineOffset: params.lineOffset,
        lineLimit: params.lineLimit,
      });
    } catch (error) {
      if (params.fallbackText) {
        return renderWorkerHtml({
          id: `read-${params.callId ?? 'unknown'}-${Date.now().toString(36)}`,
          code: params.fallbackText,
          lang: params.lang,
          theme: 'github-dark',
          gutterMode: 'single',
          lineOffset: params.lineOffset,
          lineLimit: params.lineLimit,
        });
      }
      return renderText(`Failed to load: ${params.path ?? 'unknown file'}`);
    }
  }

  function renderEditDiffHtml(params: {
    diff: string;
    code?: string;
    after?: string;
    lang: string;
  }): () => Promise<string> {
    return () =>
      renderWorkerHtml({
        id: `edit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        code: params.code ?? '',
        after: params.after,
        patch: params.diff,
        lang: params.lang,
        theme: 'github-dark',
        gutterMode: 'double',
      });
  }

  function shouldRenderToolWindow(tool: string) {
    return !TOOL_WINDOW_HIDDEN.has(tool) && TOOL_WINDOW_SUPPORTED.has(tool);
  }

  function parsePatchTextBlocks(patchText: string) {
    const lines = patchText.split('\n');
    const blocks: Array<{ path?: string; content: string }> = [];
    let currentPath: string | undefined;
    let currentKind: 'update' | 'add' | 'delete' | undefined;
    let currentLines: string[] = [];

    const pushCurrent = () => {
      if (!currentPath || currentLines.length === 0) {
        currentPath = undefined;
        currentKind = undefined;
        currentLines = [];
        return;
      }
      blocks.push({
        path: currentPath,
        content: currentLines.join('\n').trim(),
      });
      currentPath = undefined;
      currentKind = undefined;
      currentLines = [];
    };

    const startFileBlock = (kind: 'update' | 'add' | 'delete', path: string) => {
      pushCurrent();
      currentPath = path.trim();
      currentKind = kind;
      currentLines = [`diff --git a/${currentPath} b/${currentPath}`];
      if (kind === 'add') {
        currentLines.push('--- /dev/null');
        currentLines.push(`+++ b/${currentPath}`);
      } else if (kind === 'delete') {
        currentLines.push(`--- a/${currentPath}`);
        currentLines.push('+++ /dev/null');
      } else {
        currentLines.push(`--- a/${currentPath}`);
        currentLines.push(`+++ b/${currentPath}`);
      }
    };

    for (const line of lines) {
      if (line.startsWith('*** Update File: ')) {
        startFileBlock('update', line.replace('*** Update File: ', ''));
        continue;
      }
      if (line.startsWith('*** Add File: ')) {
        startFileBlock('add', line.replace('*** Add File: ', ''));
        continue;
      }
      if (line.startsWith('*** Delete File: ')) {
        startFileBlock('delete', line.replace('*** Delete File: ', ''));
        continue;
      }
      if (line.startsWith('*** Move to: ') && currentPath && currentKind === 'update') {
        const moveTo = line.replace('*** Move to: ', '').trim();
        currentLines.push(`rename from ${currentPath}`);
        currentLines.push(`rename to ${moveTo}`);
        currentPath = moveTo;
        continue;
      }
      if (!currentPath) continue;
      if (
        line.startsWith('@@') ||
        line.startsWith('+') ||
        line.startsWith('-') ||
        line.startsWith(' ') ||
        line.startsWith('\\')
      ) {
        currentLines.push(line);
      }
    }

    pushCurrent();
    return blocks;
  }

  const toolRendererHelpers = {
    [toolRendererReadTypesKey]: TOOL_RENDERER_READ_EVENT_TYPES,
    [toolRendererWriteTypesKey]: TOOL_RENDERER_WRITE_EVENT_TYPES,
    [toolRendererMessageTypesKey]: TOOL_RENDERER_MESSAGE_EVENTS,
    parsePatchTextBlocks,
    guessLanguage: guessLanguageFromPath,
    shouldRenderToolWindow,
    extractToolOutputText: parseToolOutputText,
    formatToolValue,
    renderWorkerHtml,
    renderReadHtmlFromApi,
    resolveReadWritePath,
    guessLanguageFromPath,
    resolveReadRange,
    renderEditDiffHtml,
    formatGlobToolTitle,
    formatListToolTitle,
    formatWebfetchToolTitle,
    formatQueryToolTitle,
    formatTaskToolOutput,
    GrepContent,
    GlobContent,
    WebContent,
    McpContent,
  };

  function openToolPartAsWindow(
    toolPart: ToolPart,
    overrides?: Record<string, unknown>,
    keyPrefix?: string,
  ): string[] {
    const openedKeys: string[] = [];
    const payload = {
      type: 'message.part.updated',
      payload: {
        type: 'message.part.updated',
        properties: { part: toolPart },
      },
    };

    const patchEvents = extractToolPatch(payload, toolRendererHelpers as any);
    if (patchEvents) {
      patchEvents.forEach((patchEvent: any, index: number) => {
        const rawId = patchEvent.callId ?? `apply_patch:${index}`;
        const key = keyPrefix ? `${keyPrefix}${rawId}` : rawId;
        const patchLang = patchEvent.lang ?? 'text';
        fw.open(key, {
          content: renderEditDiffHtml({
            diff: '',
            code: patchEvent.code,
            after: patchEvent.after,
            lang: patchLang,
          }),
          variant: 'diff',
          status:
            patchEvent.toolStatus === 'running' ||
            patchEvent.toolStatus === 'completed' ||
            patchEvent.toolStatus === 'error'
              ? patchEvent.toolStatus
              : undefined,
          title: patchEvent.title,
          color: toolColor(patchEvent.toolName),
          ...overrides,
        });
        openedKeys.push(key);
      });
      return openedKeys;
    }

    const fileReadResult = extractToolFileRead(
      payload,
      'message.part.updated',
      toolRendererHelpers as any,
    );
    const fileReads = fileReadResult
      ? Array.isArray(fileReadResult)
        ? fileReadResult
        : [fileReadResult]
      : null;
    if (!fileReads) return openedKeys;
    fileReads.forEach((entry: any) => {
      if (entry.callId) {
        const { callId, toolName, toolStatus, ...rest } = entry;
        const key = keyPrefix ? `${keyPrefix}${callId}` : callId;
        fw.open(key, {
          ...rest,
          status:
            toolStatus === 'running' || toolStatus === 'completed' || toolStatus === 'error'
              ? toolStatus
              : undefined,
          color: toolColor(toolName),
          ...overrides,
        });
        openedKeys.push(key);
      }
    });
    return openedKeys;
  }

  const historyToolWindowKeys = new Set<string>();

  function closeHistoryToolWindows() {
    for (const key of historyToolWindowKeys) {
      fw.close(key);
    }
    historyToolWindowKeys.clear();
  }

  function handleOpenHistoryTool(payload: { part: ToolPart }) {
    closeHistoryToolWindows();
    const { width, height } = fw.getExtent();
    const winW = 600;
    const winH = 400;
    const x = Math.max(0, Math.round((width - winW) / 2));
    const y = Math.max(0, Math.round((height - winH) / 2));
    const keys = openToolPartAsWindow(
      payload.part,
      {
        closable: true,
        resizable: true,
        focusOnOpen: true,
        expiry: Infinity,
        scroll: 'manual',
        x,
        y,
      },
      'history-tool:',
    );
    for (const key of keys) historyToolWindowKeys.add(key);
  }

  function handleOpenHistoryReasoning(payload: { part: ReasoningPart }) {
    closeHistoryToolWindows();
    const { width, height } = fw.getExtent();
    const winW = 600;
    const winH = 400;
    const x = Math.max(0, Math.round((width - winW) / 2));
    const y = Math.max(0, Math.round((height - winH) / 2));
    const key = `history-reasoning:${payload.part.id}`;
    historyToolWindowKeys.add(key);
    fw.open(key, {
      component: ReasoningContent,
      props: {
        entries: [{ id: payload.part.id, text: payload.part.text }],
        theme: 'github-dark',
      },
      title: '🤔 Thought',
      scroll: 'manual',
      closable: true,
      resizable: true,
      focusOnOpen: true,
      color: '#8b5cf6',
      variant: 'message',
      expiry: Infinity,
      width: winW,
      height: winH,
      x,
      y,
    });
  }

  function handleShowThreadHistory(payload: { entries: ThreadHistoryEntry[] }) {
    const entries = payload.entries;
    const key = 'thread-history';
    if (fw.has(key)) {
      fw.updateOptions(key, { props: { entries } });
      fw.bringToFront(key);
      return;
    }
    const { width, height } = fw.getExtent();
    const winW = 720;
    const winH = 520;
    const x = Math.max(0, Math.round((width - winW) / 2));
    const y = Math.max(0, Math.round((height - winH) / 2));
    fw.open(key, {
      component: ThreadHistoryContent,
      props: {
        entries,
        theme: shikiTheme.value,
        onToolClick: (part: ToolPart) => handleOpenHistoryTool({ part }),
        onReasoningClick: (part: ReasoningPart) => handleOpenHistoryReasoning({ part }),
      },
      title: 'Thread History',
      scroll: 'follow',
      smoothEngine: 'native',
      closable: true,
      resizable: true,
      focusOnOpen: true,
      variant: 'message',
      expiry: Infinity,
      width: winW,
      height: winH,
      x,
      y,
      afterClose: closeHistoryToolWindows,
    });
  }

  function handleOpenImage(payload: { url: string; filename: string }) {
    const { url, filename } = payload;
    const key = `image-viewer:${url}`;
    if (fw.has(key)) {
      fw.bringToFront(key);
      return;
    }
    const metrics = getCanvasMetrics(document.querySelector('.tool-window-canvas'));
    const pos = metrics ? getFileViewerPosition(metrics, 800, 600, 0.16, 0.1) : { x: 24, y: 24 };
    fw.open(key, {
      component: ContentViewer,
      props: {
        path: filename,
        imageSrc: url,
      },
      closable: true,
      resizable: true,
      focusOnOpen: true,
      scroll: 'manual',
      title: filename || 'Image',
      x: pos.x,
      y: pos.y,
      width: 800,
      height: 600,
      expiry: Infinity,
    });
  }

  return {
    formatToolValue,
    parseToolOutputText,
    formatTaskToolOutput,
    renderReadHtmlFromApi,
    renderEditDiffHtml,
    shouldRenderToolWindow,
    parsePatchTextBlocks,
    openToolPartAsWindow,
    closeHistoryToolWindows,
    handleOpenHistoryTool,
    handleOpenHistoryReasoning,
    handleShowThreadHistory,
    handleOpenImage,
    buildToolRendererHelpers: () => toolRendererHelpers,
  };
}
