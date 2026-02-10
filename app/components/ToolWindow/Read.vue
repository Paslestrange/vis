<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  state?: Record<string, unknown>;
}>();

// Extract file body from read output: parse <file> tags and strip line numbers
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

// Resolve read/write path from multiple sources
function resolveReadWritePath(
  input: Record<string, unknown> | undefined,
  metadata: Record<string, unknown> | undefined,
  state: Record<string, unknown> | undefined,
) {
  const filePath = typeof input?.filePath === 'string' ? input.filePath.trim() : '';
  if (filePath) return filePath;
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  if (path) return path;
  const metadataPath = typeof metadata?.filepath === 'string' ? metadata.filepath.trim() : '';
  if (metadataPath) return metadataPath;
  const title = typeof state?.title === 'string' ? state.title.trim() : '';
  return title || undefined;
}

// Format title: filePath → path
function formatReadLikeToolTitle(input: Record<string, unknown> | undefined) {
  const filePath = typeof input?.filePath === 'string' ? input.filePath.trim() : '';
  if (filePath) return filePath;
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  return path || undefined;
}

// Resolve read range
function resolveReadRange(input: Record<string, unknown> | undefined) {
  const offsetValue = input?.offset;
  const limitValue = input?.limit;
  const offset =
    typeof offsetValue === 'number' && Number.isFinite(offsetValue) && offsetValue >= 0
      ? Math.floor(offsetValue)
      : undefined;
  const limit =
    typeof limitValue === 'number' && Number.isFinite(limitValue) && limitValue > 0
      ? Math.floor(limitValue)
      : undefined;
  return { offset, limit };
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

const title = computed(() => {
  return formatReadLikeToolTitle(props.input) || path.value || 'Read';
});
</script>

<template>
  <CodeContent :html="displayContent" variant="code" />
</template>
