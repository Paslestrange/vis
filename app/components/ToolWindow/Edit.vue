<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  toolName?: string;
  diff?: string; // For multiedit - passed as prop from caller
  index?: number;
  total?: number;
}>();

// Format title: filePath → path
function formatReadLikeToolTitle(input: Record<string, unknown> | undefined) {
  const filePath = typeof input?.filePath === 'string' ? input.filePath.trim() : '';
  if (filePath) return filePath;
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  return path || undefined;
}

const path = computed(() => {
  return typeof props.input?.filePath === 'string' ? props.input.filePath : undefined;
});

const displayContent = computed(() => {
  // For multiedit, diff is passed as prop
  // For single edit, use metadata.diff
  return props.diff ?? (typeof props.metadata?.diff === 'string' ? props.metadata.diff : '');
});

const title = computed(() => {
  const baseTitle = formatReadLikeToolTitle(props.input);
  if (props.total && props.total > 1 && props.index !== undefined) {
    return `${baseTitle} (${props.index + 1}/${props.total})`;
  }
  return baseTitle || 'Edit';
});

const isDiff = computed(() => {
  return displayContent.value.includes('diff --git') || 
         displayContent.value.includes('---') ||
         displayContent.value.includes('+++');
});
</script>

<template>
  <CodeContent 
    :html="displayContent" 
    :variant="isDiff ? 'diff' : 'code'" 
    :gutter-mode="isDiff ? 'double' : 'single'"
  />
</template>
