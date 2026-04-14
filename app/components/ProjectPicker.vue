<template>
  <div class="modal">
    <Dropdown
      ref="dropdownRef"
      :open="dropdownOpen"
      :auto-close="false"
      :auto-focus="false"
      :auto-highlight="false"
      :popup-style="popupStyle"
      :popup-class="['picker-popup', { 'is-loading': isLoading }]"
      class="picker-dropdown"
      @select="handleItemSelect"
      @update:open="handleDropdownOpenChange"
    >
      <template #trigger>
        <div class="path-row">
          <input
            ref="inputRef"
            :value="rawInput"
            class="path-input"
            type="text"
            placeholder="Directory path..."
            @input="handleInput"
            @keydown="handleInputKeydown"
          />
          <button type="button" class="open-button" :disabled="!canOpen" @click="handleOpen">
            Open
          </button>
        </div>
        <div v-if="error" class="error-text">{{ error }}</div>
      </template>

      <DropdownItem v-if="showCurrentEntry" value=".">./</DropdownItem>
      <DropdownItem v-if="showParentEntry" value="..">../</DropdownItem>
      <DropdownItem
        v-for="item in suggestions"
        :key="item.name"
        :value="item.name"
        :disabled="isDrillDownLocked"
      >
        {{ item.name }}/
      </DropdownItem>
      <div v-if="!isLoading && suggestions.length === 0 && currentDir" class="picker-empty">
        {{ parsed.filter ? 'No matches' : 'No subdirectories' }}
      </div>
    </Dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import Dropdown from './Dropdown.vue';
import DropdownItem from './Dropdown/Item.vue';
import * as opencodeApi from '../utils/opencode';
import { splitFileContentDirectoryAndPath } from '../utils/path';

type FileNode = {
  name: string;
  path: string;
  absolute: string;
  type: 'file' | 'directory';
  ignored: boolean;
};

type DropdownHandle = {
  moveHighlight: (direction: 'up' | 'down') => void;
  selectHighlighted: () => boolean;
  clearHighlight: () => void;
};

const props = defineProps<{
  homePath?: string;
}>();

const emit = defineEmits<{
  (event: 'select', directory: string): void;
  (event: 'close'): void;
}>();

const dropdownRef = ref<DropdownHandle | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const rawInput = ref('');
const isLoading = ref(false);
const error = ref('');
const allEntries = ref<FileNode[]>([]);
const dropdownOpen = ref(false);
const hasGitDirectory = ref(false);
let fetchController: AbortController | null = null;
let fetchRequestId = 0;

const popupStyle = { maxHeight: '40vh' };

/** Home path with trailing slash, for tilde expansion/collapse. */
const homePrefix = computed(() => {
  const h = props.homePath?.trim();
  return h ? ensureTrailingSlash(h) : '';
});

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

/** Split the raw input into an absolute directory and a trailing filter string. */
const parsed = computed(() => {
  const expanded = expandTilde(rawInput.value);
  const lastSlash = expanded.lastIndexOf('/');
  if (lastSlash < 0) return { dir: '', filter: expanded };
  return {
    dir: expanded.slice(0, lastSlash + 1),
    filter: expanded.slice(lastSlash + 1),
  };
});

/** Absolute directory path (the part before the trailing filter). */
const currentDir = computed(() => parsed.value.dir);

/** Directory entries filtered by the trailing text after the last `/`. */
const suggestions = computed(() => {
  const { filter } = parsed.value;
  const dirs = allEntries.value.filter((n) => n.type === 'directory' && !n.ignored);
  if (!filter) return dirs;
  const lower = filter.toLowerCase();
  return dirs.filter((n) => n.name.toLowerCase().startsWith(lower));
});

const isAtRoot = computed(() => {
  const dir = currentDir.value;
  return !dir || dir === '/';
});

/** Show `./` when filter is empty or starts with `.`. */
const showCurrentEntry = computed(() => {
  const { filter } = parsed.value;
  if (!filter) return true;
  return '.'.startsWith(filter.toLowerCase());
});

/** Show `../` when filter is empty or starts with `.`, except at root. */
const showParentEntry = computed(() => {
  if (isAtRoot.value) return false;
  const { filter } = parsed.value;
  if (!filter) return true;
  return '..'.startsWith(filter.toLowerCase());
});

const hasDirectoryEntries = computed(() =>
  allEntries.value.some((n) => n.type === 'directory' && !n.ignored),
);

const canOpen = computed(() => Boolean(resolveOpenDirectory()));

const isDrillDownLocked = computed(() => hasGitDirectory.value);

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

watch(currentDir, (dir) => {
  if (!dir) {
    allEntries.value = [];
    hasGitDirectory.value = false;
    return;
  }
  void fetchDirectory(dir);
});

onMounted(() => {
  dropdownOpen.value = true;
  initPicker();
});

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

function initPicker() {
  error.value = '';
  allEntries.value = [];
  hasGitDirectory.value = false;
  rawInput.value = '';

  const initial = homePrefix.value || '/';
  rawInput.value = collapseTilde(initial);
  const dir = currentDir.value;
  if (dir) void fetchDirectory(dir);

  nextTick(() => {
    inputRef.value?.focus();
    const len = rawInput.value.length;
    inputRef.value?.setSelectionRange(len, len);
  });
}

// ---------------------------------------------------------------------------
// Directory fetching
// ---------------------------------------------------------------------------

async function fetchDirectory(dir: string) {
  if (fetchController) {
    fetchController.abort();
    fetchController = null;
  }

  const requestId = ++fetchRequestId;
  const controller = new AbortController();
  fetchController = controller;
  isLoading.value = true;
  error.value = '';

  try {
    const cleanDir = dir.replace(/\/+$/, '') || '/';
    const [data, gitEntries] = await Promise.all([
      listDirectory(cleanDir, controller.signal),
      listDirectory(`${cleanDir}/.git`, controller.signal),
    ]);
    if (requestId !== fetchRequestId) return;
    allEntries.value = data;
    hasGitDirectory.value = gitEntries.length > 0;
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    if (requestId !== fetchRequestId) return;
    error.value = err instanceof Error ? err.message : String(err);
    allEntries.value = [];
    hasGitDirectory.value = false;
  } finally {
    if (requestId === fetchRequestId) isLoading.value = false;
  }
}

async function listDirectory(dir: string, signal: AbortSignal) {
  const { directory, path } = splitFileContentDirectoryAndPath(dir, null);
  const data = (await opencodeApi.listFiles(
    {
      directory,
      path,
    },
    { signal },
  )) as FileNode[];
  return Array.isArray(data) ? data : [];
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

function handleInput(e: Event) {
  let value = (e.target as HTMLInputElement).value;
  let didNormalize = false;

  // Resolve ../ and ./ immediately so the path stays clean.
  if (value.includes('../') || value.includes('/./')) {
    const expanded = expandTilde(value);
    value = collapseTilde(normalizePath(expanded));
    didNormalize = true;
  }

  rawInput.value = value;
  dropdownRef.value?.clearHighlight();

  if (didNormalize) {
    nextTick(() => {
      inputRef.value?.setSelectionRange(value.length, value.length);
    });
  }
}

function handleInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    handleClose();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    dropdownRef.value?.moveHighlight('down');
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    dropdownRef.value?.moveHighlight('up');
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    const selected = dropdownRef.value?.selectHighlighted() ?? false;
    if (!selected) handleOpen();
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    handleTab(e.shiftKey);
    return;
  }
}

// ---------------------------------------------------------------------------
// Tab completion (shell-style)
// ---------------------------------------------------------------------------

function handleTab(reverse = false) {
  // Collect Tab completion candidates (`./` is intentionally excluded).
  const names: string[] = [];
  if (showParentEntry.value && hasDirectoryEntries.value) names.push('..');
  if (!isDrillDownLocked.value) {
    for (const s of suggestions.value) names.push(s.name);
  }

  if (names.length === 0) return;

  // Single match — select immediately
  if (names.length === 1) {
    handleItemSelect(names[0]);
    return;
  }

  // Multiple matches — try to extend input to longest common prefix
  const { filter } = parsed.value;
  const lcp = longestCommonPrefix(names);

  if (lcp.length > filter.length) {
    // Extend input to LCP (partial completion)
    const { dir } = parsed.value;
    rawInput.value = collapseTilde(dir + lcp);
    nextTick(() => {
      inputRef.value?.focus();
      const len = rawInput.value.length;
      inputRef.value?.setSelectionRange(len, len);
    });
  } else {
    // LCP already matches filter — cycle through highlighted items
    dropdownRef.value?.moveHighlight(reverse ? 'up' : 'down');
  }
}

function longestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  const first = strings[0];
  let len = first.length;
  for (let i = 1; i < strings.length; i++) {
    len = Math.min(len, strings[i].length);
    for (let j = 0; j < len; j++) {
      if (first[j].toLowerCase() !== strings[i][j].toLowerCase()) {
        len = j;
        break;
      }
    }
  }
  return first.slice(0, len);
}

// ---------------------------------------------------------------------------
// Selection / navigation
// ---------------------------------------------------------------------------

function handleItemSelect(value: unknown) {
  if (typeof value !== 'string') return;
  if (value === '.') {
    nextTick(() => {
      inputRef.value?.focus();
      const len = rawInput.value.length;
      inputRef.value?.setSelectionRange(len, len);
    });
    return;
  }
  if (value === '..') {
    goUp();
  } else {
    if (isDrillDownLocked.value) return;
    appendToPath(value);
  }
  nextTick(() => {
    inputRef.value?.focus();
    const len = rawInput.value.length;
    inputRef.value?.setSelectionRange(len, len);
  });
}

function appendToPath(name: string) {
  const { dir } = parsed.value;
  rawInput.value = collapseTilde(dir + name + '/');
}

function goUp() {
  const dir = currentDir.value;
  if (!dir || dir === '/') return;
  // Strip the last path component: /home/user/projects/ → /home/user/
  const parent = dir.replace(/[^/]+\/$/, '') || '/';
  rawInput.value = collapseTilde(parent);
}

function handleOpen() {
  const target = resolveOpenDirectory();
  if (!target) return;
  emit('select', target);
  handleClose();
}

function handleClose() {
  emit('close');
}

function handleDropdownOpenChange(value: boolean) {
  dropdownOpen.value = value;
  if (!value) {
    // Dropdown tried to close (Escape on menu, outside click) — close the window
    handleClose();
  }
}

// ---------------------------------------------------------------------------
// Path utilities
// ---------------------------------------------------------------------------

function expandTilde(p: string): string {
  const home = homePrefix.value;
  if (!home) return p;
  if (p === '~') return home;
  if (p.startsWith('~/')) return home + p.slice(2);
  return p;
}

function collapseTilde(p: string): string {
  const home = homePrefix.value;
  if (!home) return p;
  if (p === home || p === home.replace(/\/$/, '')) return '~/';
  if (p.startsWith(home)) return '~/' + p.slice(home.length);
  return p;
}

function normalizePath(p: string): string {
  if (!p) return p;
  const parts = p.split('/');
  const result: string[] = [];
  for (const part of parts) {
    if (part === '..') {
      if (result.length > 0 && result[result.length - 1] !== '') result.pop();
    } else if (part !== '.') {
      result.push(part);
    }
  }
  return result.join('/');
}

function ensureTrailingSlash(p: string): string {
  return p.endsWith('/') ? p : p + '/';
}

function resolveOpenDirectory(): string | null {
  const dir = currentDir.value;
  if (!dir) return null;

  const { filter } = parsed.value;
  if (!filter) {
    return cleanDirectoryPath(dir);
  }

  if (filter === '.') {
    return null;
  }

  if (filter === '..') {
    if (dir === '/') return null;
    const parent = dir.replace(/[^/]+\/$/, '') || '/';
    return cleanDirectoryPath(parent);
  }

  if (isDrillDownLocked.value) {
    return null;
  }

  const matched = allEntries.value.find(
    (n) => n.type === 'directory' && !n.ignored && n.name.toLowerCase() === filter.toLowerCase(),
  );
  if (!matched) return null;

  return cleanDirectoryPath(`${dir}${matched.name}/`);
}

function cleanDirectoryPath(p: string): string {
  const normalized = normalizePath(expandTilde(p));
  const clean = normalized.replace(/\/+$/, '');
  return clean || '/';
}
</script>

<style scoped>
.modal {
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid #334155;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(2, 6, 23, 0.45);
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
}

.picker-dropdown {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.path-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.path-input {
  flex: 1;
  min-width: 0;
  background: #0b1320;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}

.path-input:focus {
  border-color: #60a5fa;
}

.open-button {
  flex-shrink: 0;
  background: #1e40af;
  color: #e2e8f0;
  border: 1px solid #2563eb;
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.open-button:hover:not(:disabled) {
  background: #2563eb;
}

.open-button:disabled {
  opacity: 0.5;
  cursor: default;
}

:deep(.picker-popup) {
  min-height: 80px;
}

:deep(.picker-popup.is-loading) {
  opacity: 0.6;
}

.picker-empty {
  font-size: 12px;
  color: #64748b;
  padding: 4px 8px;
}

.error-text {
  font-size: 12px;
  color: #fecaca;
}
</style>
