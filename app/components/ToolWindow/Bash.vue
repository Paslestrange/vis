<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
  state?: Record<string, unknown>;
}>();

// Format bash content: $ command\n\noutput
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

// Format title: description → state.title → command first line
function formatBashToolTitle(
  input: Record<string, unknown> | undefined,
  state: Record<string, unknown> | undefined,
) {
  const description = typeof input?.description === 'string' ? input.description.trim() : '';
  if (description) return description;
  const stateTitle = typeof state?.title === 'string' ? state.title.trim() : '';
  if (stateTitle) return stateTitle;
  const command = typeof input?.command === 'string' ? input.command.trim() : '';
  if (!command) return undefined;
  const firstLine = command.split('\n')[0]?.trim() ?? '';
  return firstLine.length > 96 ? `${firstLine.slice(0, 93)}...` : firstLine;
}

const displayContent = computed(() => {
  return formatBashToolContent(props.input, props.output ?? props.error ?? '', props.status);
});

const title = computed(() => {
  return formatBashToolTitle(props.input, props.state) || 'Bash';
});
</script>

<template>
  <CodeContent :html="displayContent" variant="code" wrap-mode="soft" gutter-mode="none" />
</template>
