<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
  toolName?: string;
}>();

// Format webfetch title: url
function formatWebfetchToolTitle(input: Record<string, unknown> | undefined) {
  const url = typeof input?.url === 'string' ? input.url.trim() : '';
  return url || undefined;
}

// Format query title: query
function formatQueryToolTitle(input: Record<string, unknown> | undefined) {
  const query = typeof input?.query === 'string' ? input.query.trim() : '';
  return query || undefined;
}

const displayContent = computed(() => {
  return props.output ?? '';
});

const title = computed(() => {
  if (props.toolName === 'webfetch') {
    return formatWebfetchToolTitle(props.input) || 'Web Fetch';
  }
  return formatQueryToolTitle(props.input) || 'Search';
});

const lang = computed(() => {
  if (props.toolName === 'webfetch') {
    const format = typeof props.input?.format === 'string' ? props.input.format : 'markdown';
    if (format === 'html') return 'html';
    if (format === 'text') return 'text';
    return 'markdown';
  }
  return 'markdown';
});
</script>

<template>
  <CodeContent :html="displayContent" variant="code" gutter-mode="none" />
</template>
