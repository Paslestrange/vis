<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
}>();

// Parse grep output with source lines: "Line N: text" pattern
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

// Format title: pattern + path + include
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

const hasSourceLines = computed(() => {
  return parsed.value !== null;
});

const title = computed(() => {
  return formatGlobToolTitle(props.input) || 'Grep';
});
</script>

<template>
  <CodeContent 
    :html="displayContent" 
    variant="code" 
    gutter-mode="single"
    :gutter-lines="gutterLines"
  />
</template>
