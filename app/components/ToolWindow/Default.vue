<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';
import { useCodeRender } from '../../utils/useCodeRender';
import { guessLanguageFromPath } from './utils';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  state?: Record<string, unknown>;
  toolName?: string;
}>();

const displayContent = computed(() => {
  return props.output ?? '';
});

const lang = computed(() => {
  if (props.toolName === 'write') {
    const path = typeof props.input?.filePath === 'string' ? props.input.filePath
      : typeof props.input?.path === 'string' ? props.input.path : undefined;
    return guessLanguageFromPath(path);
  }
  return 'text';
});

const { html: renderedHtml } = useCodeRender(() => ({
  code: displayContent.value,
  lang: lang.value,
  theme: 'github-dark',
  gutterMode: 'single' as const,
}));
</script>

<template>
  <CodeContent :html="renderedHtml" variant="code" />
</template>
