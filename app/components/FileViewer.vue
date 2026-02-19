<template>
  <div class="file-viewer-content">
    <div v-if="hasTabs" class="viewer-tabs">
      <button
        v-for="(tab, i) in diffTabs"
        :key="tab.file"
        type="button"
        class="viewer-tab"
        :class="{ active: i === activeTabIndex }"
        @click="activeTabIndex = i"
      >
        {{ basename(tab.file) }}
      </button>
    </div>
    <div ref="viewerBodyEl" class="viewer-body">
      <div v-if="showLoading" class="viewer-loading">Loading…</div>
      <CodeContent v-else :html="renderedHtml || rawHtml || ''" :variant="viewerVariant" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import CodeContent from './CodeContent.vue';
import { type CodeRenderParams, useCodeRender } from '../utils/useCodeRender';

const props = defineProps<{
  path?: string;
  rawHtml?: string;
  fileContent?: string;
  lang?: string;
  isBinary?: boolean;
  isDiff?: boolean;
  diffCode?: string;
  diffAfter?: string;
  diffPatch?: string;
  diffTabs?: Array<{ file: string; before: string; after: string }>;
  gutterMode?: 'default' | 'none' | 'grep-source';
  theme?: string;
  line?: number;
  endLine?: number;
}>();

const activeTabIndex = ref(0);
const viewerBodyEl = ref<HTMLDivElement | null>(null);

const hasTabs = computed(() => props.diffTabs && props.diffTabs.length > 1);

const activeDiffCode = computed(() => {
  const tabs = props.diffTabs;
  if (!tabs || tabs.length === 0) return props.diffCode ?? '';
  return tabs[activeTabIndex.value]?.before ?? '';
});

const activeDiffAfter = computed(() => {
  const tabs = props.diffTabs;
  if (!tabs || tabs.length === 0) return props.diffAfter;
  return tabs[activeTabIndex.value]?.after;
});

const activeDiffLang = computed(() => {
  const tabs = props.diffTabs;
  if (!tabs || tabs.length === 0) return props.lang ?? 'text';
  const file = tabs[activeTabIndex.value]?.file ?? '';
  const ext = file.split('.').pop() ?? '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    vue: 'vue',
    css: 'css',
    scss: 'scss',
    html: 'html',
    json: 'json',
    md: 'markdown',
    py: 'python',
    rs: 'rust',
    go: 'go',
    rb: 'ruby',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    sh: 'bash',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
  };
  return langMap[ext] ?? 'text';
});

const viewerGutterMode = computed<'none' | 'single' | 'double'>(() => {
  if (props.isDiff) return 'double';
  if (props.gutterMode === 'none') return 'none';
  return 'single';
});

const viewerVariant = computed<'code' | 'diff' | 'binary' | 'plain'>(() => {
  if (props.isDiff) return 'diff';
  if (props.isBinary) return 'binary';
  if (props.gutterMode === 'none') return 'plain';
  return 'code';
});

const renderParams = computed<CodeRenderParams | null>(() => {
  if (props.isDiff) {
    const hasDiffTabs = props.diffTabs && props.diffTabs.length > 0;
    return {
      code: activeDiffCode.value,
      after: activeDiffAfter.value,
      patch: hasDiffTabs ? undefined : props.diffPatch || undefined,
      lang: activeDiffLang.value,
      theme: props.theme || 'github-dark',
      gutterMode: viewerGutterMode.value,
    };
  }
  if (props.isBinary && props.rawHtml) return null;
  const code = props.fileContent ?? '';
  if (!code && !props.rawHtml) return null;
  if (!code) return null;
  return {
    code,
    lang: props.lang ?? 'text',
    theme: props.theme || 'github-dark',
    gutterMode: viewerGutterMode.value,
  };
});

const { html: renderedHtml } = useCodeRender(renderParams);

function clearLineHighlights() {
  const root = viewerBodyEl.value;
  if (!root) return;
  root.querySelectorAll('.code-row.line-highlight').forEach((row) => {
    row.classList.remove('line-highlight');
  });
}

function applyLineSelection() {
  const root = viewerBodyEl.value;
  if (!root) return;

  clearLineHighlights();

  const line = props.line;
  if (!line || !Number.isInteger(line) || line < 1) return;

  const rows = Array.from(root.querySelectorAll<HTMLElement>('.code-row'));
  if (rows.length === 0) return;

  const start = line;
  const rawEndLine = props.endLine;
  const end =
    rawEndLine && Number.isInteger(rawEndLine) && rawEndLine >= start ? rawEndLine : start;
  const clampedStart = Math.min(start, rows.length);
  const clampedEnd = Math.min(Math.max(end, clampedStart), rows.length);

  for (let index = clampedStart - 1; index < clampedEnd; index += 1) {
    rows[index]?.classList.add('line-highlight');
  }

  rows[clampedStart - 1]?.scrollIntoView({ block: 'center', inline: 'nearest' });
}

watch(
  [
    () => renderedHtml.value,
    () => props.rawHtml,
    () => props.line,
    () => props.endLine,
    () => activeTabIndex.value,
  ],
  () => {
    nextTick(() => {
      applyLineSelection();
    });
  },
  { immediate: true },
);

const showLoading = computed(() => {
  // Already have displayable content
  if (renderedHtml.value || props.rawHtml) return false;
  // Render worker is processing — keep showing loading
  if (renderParams.value) return true;
  // No content provided yet — waiting for data
  if (props.fileContent == null && !props.isDiff) return true;
  // Content provided but nothing to render (e.g. empty file)
  return false;
});

function basename(filepath: string) {
  return filepath.split('/').pop() ?? filepath;
}
</script>

<style scoped>
.file-viewer-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.viewer-tabs {
  display: flex;
  gap: 0;
  background: rgba(26, 29, 36, 0.95);
  border-bottom: 1px solid rgba(90, 100, 120, 0.35);
  overflow-x: auto;
  scrollbar-width: none;
  flex-shrink: 0;
}

.viewer-tabs::-webkit-scrollbar {
  display: none;
}

.viewer-tab {
  border: 0;
  background: transparent;
  color: #8a8f9a;
  font-size: 11px;
  font-family: inherit;
  padding: 3px 10px;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.viewer-tab:hover {
  color: #cbd5e1;
}

.viewer-tab.active {
  color: #e2e8f0;
  border-bottom-color: #60a5fa;
}

.viewer-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.file-viewer-content :deep(.code-row.line-highlight) {
  background: rgba(148, 163, 184, 0.15);
}

.viewer-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
  font-size: 13px;
  user-select: none;
}
</style>
