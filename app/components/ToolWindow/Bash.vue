<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';
import { useCodeRender } from '../../utils/useCodeRender';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
  state?: Record<string, unknown>;
}>();

function formatBashToolContent(
  input: Record<string, unknown> | undefined,
  output: string,
  status?: string,
) {
  const command = typeof input?.command === 'string' ? input.command : '';
  const lines: string[] = [];
  if (command.trim()) {
    lines.push(`$ ${command}`);
  }
  if (output.trim()) {
    if (lines.length > 0) lines.push('');
    lines.push(output);
  }
  if (lines.length === 0 && status === 'running') return '$';
  return lines.join('\n');
}

const displayContent = computed(() => {
  return formatBashToolContent(props.input, props.output ?? props.error ?? '', props.status);
});

const { html: renderedHtml } = useCodeRender(() => ({
  code: displayContent.value,
  lang: 'shellscript',
  theme: 'github-dark',
  gutterMode: 'none' as const,
}));
</script>

<template>
  <CodeContent :html="renderedHtml" variant="term" />
</template>
