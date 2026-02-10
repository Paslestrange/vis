<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';
import { useCodeRender } from '../../utils/useCodeRender';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
  toolName?: string;
}>();

const displayContent = computed(() => {
  return props.output ?? '';
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

const { html: renderedHtml } = useCodeRender(() => ({
  code: displayContent.value,
  lang: lang.value,
  theme: 'github-dark',
  gutterMode: 'none' as const,
}));
</script>

<template>
  <CodeContent :html="renderedHtml" variant="plain" />
</template>
