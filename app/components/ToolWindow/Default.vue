<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  state?: Record<string, unknown>;
  toolName?: string;
}>();

// Format list title: path
function formatListToolTitle(input: Record<string, unknown> | undefined) {
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  return path || undefined;
}

// Format read-like title: filePath → path
function formatReadLikeToolTitle(input: Record<string, unknown> | undefined) {
  const filePath = typeof input?.filePath === 'string' ? input.filePath.trim() : '';
  if (filePath) return filePath;
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  return path || undefined;
}

const displayContent = computed(() => {
  return props.output ?? '';
});

const title = computed(() => {
  switch (props.toolName) {
    case 'list':
      return formatListToolTitle(props.input) || 'List';
    case 'write':
      return formatReadLikeToolTitle(props.input) || 'Write';
    case 'batch':
      return 'Batch execution';
    case 'plan_enter':
    case 'plan_exit':
      return (typeof props.state?.title === 'string' ? props.state.title : '') || props.toolName;
    default:
      return props.toolName || 'Tool';
  }
});

const lang = computed(() => {
  switch (props.toolName) {
    case 'write':
      return 'text'; // Could guess from path
    case 'batch':
    case 'plan_enter':
    case 'plan_exit':
      return 'text';
    default:
      return 'text';
  }
});
</script>

<template>
  <CodeContent :html="displayContent" variant="code" gutter-mode="none" />
</template>
