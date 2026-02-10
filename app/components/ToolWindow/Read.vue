<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';
import { useCodeRender } from '../../utils/useCodeRender';
import { resolveReadWritePath, resolveReadRange, guessLanguageFromPath } from './utils';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  state?: Record<string, unknown>;
}>();

function extractFileBodyFromReadOutput(output: string) {
  const startTag = '<file>';
  const endTag = '</file>';
  const startIndex = output.indexOf(startTag);
  const endIndex = output.lastIndexOf(endTag);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return null;
  const body = output.slice(startIndex + startTag.length, endIndex);
  const lines = body.split('\n');
  const contentLines: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(\d+)\|(.*)$/);
    if (!match) continue;
    contentLines.push(match[2] ?? '');
  }
  if (contentLines.length === 0) return null;
  return contentLines.join('\n');
}

const path = computed(() => {
  return resolveReadWritePath(props.input, props.metadata, props.state);
});

const displayContent = computed(() => {
  if (!props.output) return '';
  return extractFileBodyFromReadOutput(props.output) ?? props.output;
});

const readRange = computed(() => {
  return resolveReadRange(props.input);
});

const lang = computed(() => {
  return guessLanguageFromPath(path.value);
});

const { html: renderedHtml } = useCodeRender(() => ({
  code: displayContent.value,
  lang: lang.value,
  theme: 'github-dark',
  gutterMode: 'single' as const,
  lineOffset: readRange.value.offset,
  lineLimit: readRange.value.limit,
}));
</script>

<template>
  <CodeContent :html="renderedHtml" variant="code" />
</template>
