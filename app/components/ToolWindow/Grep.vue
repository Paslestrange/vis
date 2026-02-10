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

function parseGrepOutputWithSourceLines(output: string) {
  const lines = output.split('\n');
  const contentLines: string[] = [];
  const gutterLines: string[] = [];
  let hasSourceLine = false;

  for (const line of lines) {
    const match = line.match(/^\s*Line\s+(\d+):\s?(.*)$/);
    if (match) {
      hasSourceLine = true;
      gutterLines.push(match[1] ?? '');
      contentLines.push(match[2] ?? '');
      continue;
    }
    gutterLines.push('');
    contentLines.push(line);
  }

  if (!hasSourceLine) return null;
  return {
    content: contentLines.join('\n'),
    gutterLines,
  };
}

const parsed = computed(() => {
  if (!props.output) return null;
  return parseGrepOutputWithSourceLines(props.output);
});

const displayContent = computed(() => {
  return parsed.value?.content ?? props.output ?? '';
});

const gutterLines = computed(() => {
  return parsed.value?.gutterLines;
});

const grepPattern = computed(() => {
  return typeof props.input?.pattern === 'string' ? props.input.pattern : undefined;
});

const { html: renderedHtml } = useCodeRender(() => ({
  code: displayContent.value,
  lang: 'text',
  theme: 'github-dark',
  gutterMode: 'single' as const,
  gutterLines: gutterLines.value,
  grepPattern: grepPattern.value,
}));
</script>

<template>
  <CodeContent :html="renderedHtml" variant="code" />
</template>
