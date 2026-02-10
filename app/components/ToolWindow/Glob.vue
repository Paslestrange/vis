<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
}>();

// Format title: pattern + path + include (shared with Grep)
function formatGlobToolTitle(input: Record<string, unknown> | undefined) {
  const pattern = typeof input?.pattern === 'string' ? input.pattern.trim() : '';
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  const include = typeof input?.include === 'string' ? input.include.trim() : '';
  const segments: string[] = [];
  if (pattern) segments.push(pattern);
  if (path) segments.push(`@ ${path}`);
  if (include) segments.push(`include ${include}`);
  const title = segments.join(' ');
  return title || undefined;
}

const displayContent = computed(() => {
  return props.output ?? '';
});

const title = computed(() => {
  return formatGlobToolTitle(props.input) || 'Glob';
});
</script>

<template>
  <CodeContent :html="displayContent" variant="code" gutter-mode="none" />
</template>
