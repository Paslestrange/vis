<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';
import { useCodeRender } from '../../utils/useCodeRender';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
}>();

const displayContent = computed(() => {
  return props.output ?? '';
});

const { html: renderedHtml } = useCodeRender(() => ({
  code: displayContent.value,
  lang: 'text',
  theme: 'github-dark',
  gutterMode: 'none' as const,
}));
</script>

<template>
  <CodeContent :html="renderedHtml" variant="term" />
</template>
