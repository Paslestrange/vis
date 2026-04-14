<template>
  <div class="palette" @click.stop>
    <div class="palette-search">
        <Icon icon="lucide:search" :width="16" :height="16" class="palette-search-icon" />
        <input
          ref="inputRef"
          v-model="queryValue"
          type="text"
          class="palette-input"
          placeholder="Type a command or search..."
          @keydown="handleKeydown"
        />
        <kbd class="palette-keyhint" @click="handleClose">Esc</kbd>
      </div>
      <div ref="resultsRef" class="palette-results">
        <template v-if="flatItems.length === 0">
          <div class="palette-empty">No results found</div>
        </template>
        <template v-else>
          <div v-for="group in props.groups" :key="group.label" class="palette-group">
            <div v-if="group.results.length > 0" class="palette-group-label">{{ group.label }}</div>
            <div
              v-for="(result, index) in group.results"
              :key="resultTypeKey(result, index)"
              class="palette-item"
              :class="{ 'is-selected': selectedFlatIndex === flatIndexOf(result) }"
              @mouseenter="selectedFlatIndex = flatIndexOf(result)"
              @click="execute(result)"
            >
              <Icon
                :icon="resultIcon(result)"
                :width="14"
                :height="14"
                class="palette-item-icon"
              />
              <div class="palette-item-content">
                <div class="palette-item-title">{{ resultTitle(result) }}</div>
                <div v-if="resultSubtitle(result)" class="palette-item-subtitle">
                  {{ resultSubtitle(result) }}
                </div>
              </div>
              <div v-if="resultHint(result)" class="palette-item-hint">{{ resultHint(result) }}</div>
            </div>
          </div>
        </template>
      </div>
      <div class="palette-footer">
        <span class="palette-footer-hint">
          <kbd class="palette-kbd">
            <Icon icon="lucide:arrow-up" :width="10" :height="10" />
            <Icon icon="lucide:arrow-down" :width="10" :height="10" />
          </kbd>
          to navigate
        </span>
        <span class="palette-footer-hint">
          <kbd class="palette-kbd">
            <Icon icon="lucide:corner-down-left" :width="10" :height="10" />
          </kbd>
          to select
        </span>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import type { CommandPaletteGroup, CommandPaletteResult } from '../composables/useCommandPalette';

const props = defineProps<{
  query: string;
  groups: CommandPaletteGroup[];
}>();

const emit = defineEmits<{
  (event: 'update:query', value: string): void;
  (event: 'execute', result: CommandPaletteResult): void;
  (event: 'close'): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const resultsRef = ref<HTMLDivElement | null>(null);
const selectedFlatIndex = ref(0);

const queryValue = computed({
  get: () => props.query,
  set: (value) => emit('update:query', value),
});

const flatItems = computed(() => props.groups.flatMap((group) => group.results));

onMounted(() => {
  selectedFlatIndex.value = 0;
  nextTick(() => inputRef.value?.focus());
});

function flatIndexOf(result: CommandPaletteResult): number {
  return flatItems.value.findIndex((item) => item === result);
}

function resultTypeKey(result: CommandPaletteResult, index: number): string {
  if (result.type === 'session') return `session-${result.item.id}-${index}`;
  if (result.type === 'project') return `project-${result.item.id}-${index}`;
  if (result.type === 'command') return `command-${result.item.name}-${index}`;
  return `settings-${index}`;
}

function resultIcon(result: CommandPaletteResult): string {
  switch (result.type) {
    case 'session':
      return 'lucide:message-square';
    case 'project':
      return 'lucide:folder';
    case 'command':
      return 'lucide:terminal';
    case 'settings':
      return 'lucide:settings';
    default:
      return 'lucide:circle';
  }
}

function resultTitle(result: CommandPaletteResult): string {
  switch (result.type) {
    case 'session':
      return result.item.title || result.item.slug || result.item.id;
    case 'project':
      return result.item.name;
    case 'command':
      return `/${result.item.name}`;
    case 'settings':
      return 'Open Settings';
    default:
      return '';
  }
}

function resultSubtitle(result: CommandPaletteResult): string | undefined {
  switch (result.type) {
    case 'session':
      if (result.item.title && result.item.slug) return result.item.id;
      return undefined;
    case 'project':
      return result.item.worktree;
    case 'command':
      return result.item.description;
    default:
      return undefined;
  }
}

function resultHint(result: CommandPaletteResult): string | undefined {
  if (result.type === 'command' && result.item.hints && result.item.hints.length > 0) {
    return result.item.hints[0];
  }
  if (result.type === 'settings') {
    return 'Ctrl-,';
  }
  return undefined;
}

function execute(result: CommandPaletteResult) {
  emit('execute', result);
}

function handleClose() {
  emit('close');
}

function moveHighlight(direction: 'up' | 'down') {
  const count = flatItems.value.length;
  if (count === 0) return;
  if (direction === 'down') {
    selectedFlatIndex.value = (selectedFlatIndex.value + 1) % count;
  } else {
    selectedFlatIndex.value = (selectedFlatIndex.value - 1 + count) % count;
  }
  scrollSelectedIntoView();
}

function scrollSelectedIntoView() {
  nextTick(() => {
    const container = resultsRef.value;
    if (!container) return;
    const selected = container.querySelector('.palette-item.is-selected') as HTMLElement | null;
    if (!selected) return;
    selected.scrollIntoView({ block: 'nearest' });
  });
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    handleClose();
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveHighlight('down');
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveHighlight('up');
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const result = flatItems.value[selectedFlatIndex.value];
    if (result) execute(result);
    return;
  }
  if (event.key === 'Tab') {
    event.preventDefault();
    moveHighlight(event.shiftKey ? 'up' : 'down');
  }
}

watch(
  () => props.query,
  () => {
    selectedFlatIndex.value = 0;
  },
);
</script>

<style scoped>
.palette {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid #334155;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(2, 6, 23, 0.45);
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  overflow: hidden;
}

.palette-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #1e293b;
}

.palette-search-icon {
  color: #64748b;
  flex-shrink: 0;
}

.palette-input {
  flex: 1 1 auto;
  min-width: 0;
  background: transparent;
  border: none;
  color: #e2e8f0;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  padding: 0;
}

.palette-input::placeholder {
  color: #64748b;
}

.palette-keyhint {
  flex-shrink: 0;
  font-size: 10px;
  color: #64748b;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid #334155;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
}

.palette-keyhint:hover {
  color: #e2e8f0;
  border-color: #475569;
}

.palette-results {
  max-height: min(50vh, 400px);
  overflow-y: auto;
  padding: 8px;
}

.palette-empty {
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  color: #64748b;
}

.palette-group-label {
  padding: 6px 8px 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}

.palette-item:hover,
.palette-item.is-selected {
  background: rgba(30, 41, 59, 0.7);
}

.palette-item-icon {
  color: #94a3b8;
  flex-shrink: 0;
}

.palette-item-content {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.palette-item-title {
  font-size: 12px;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette-item-subtitle {
  font-size: 10px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette-item-hint {
  flex-shrink: 0;
  font-size: 10px;
  color: #64748b;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid #334155;
  border-radius: 4px;
  padding: 2px 6px;
}

.palette-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-top: 1px solid #1e293b;
  background: rgba(2, 6, 23, 0.35);
}

.palette-footer-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #64748b;
}

.palette-kbd {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: #94a3b8;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid #334155;
  border-radius: 4px;
  padding: 2px 5px;
}

html.theme-light .palette {
  background: rgba(255, 255, 255, 0.98);
  border-color: #cbd5e1;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  color: #0f172a;
}

html.theme-light .palette-search {
  border-bottom-color: #e2e8f0;
}

html.theme-light .palette-input {
  color: #0f172a;
}

html.theme-light .palette-input::placeholder {
  color: #94a3b8;
}

html.theme-light .palette-keyhint {
  color: #64748b;
  background: rgba(226, 232, 240, 0.8);
  border-color: #cbd5e1;
}

html.theme-light .palette-keyhint:hover {
  color: #0f172a;
  border-color: #94a3b8;
}

html.theme-light .palette-empty {
  color: #94a3b8;
}

html.theme-light .palette-group-label {
  color: #94a3b8;
}

html.theme-light .palette-item:hover,
html.theme-light .palette-item.is-selected {
  background: rgba(226, 232, 240, 0.8);
}

html.theme-light .palette-item-icon {
  color: #64748b;
}

html.theme-light .palette-item-title {
  color: #0f172a;
}

html.theme-light .palette-item-subtitle {
  color: #64748b;
}

html.theme-light .palette-item-hint {
  color: #64748b;
  background: rgba(226, 232, 240, 0.6);
  border-color: #cbd5e1;
}

html.theme-light .palette-footer {
  border-top-color: #e2e8f0;
  background: rgba(248, 250, 252, 0.85);
}

html.theme-light .palette-footer-hint {
  color: #94a3b8;
}

html.theme-light .palette-kbd {
  color: #64748b;
  background: rgba(226, 232, 240, 0.8);
  border-color: #cbd5e1;
}
</style>
