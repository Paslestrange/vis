<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';

const props = defineProps<{
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: string;
}>();

// Format task output: extract task_id + <task_result>
function formatTaskToolOutput(output: string) {
  const taskIdMatch = output.match(/^task_id:\s*(.+)$/m);
  const bodyMatch = output.match(/<task_result>\n?([\s\S]*?)\n?<\/task_result>/);
  const parts: string[] = [];
  if (taskIdMatch?.[1]) parts.push(`task_id: ${taskIdMatch[1].trim()}`);
  if (bodyMatch?.[1]) parts.push(bodyMatch[1].trim());
  if (parts.length > 0) return parts.join('\n\n');
  return output;
}

const displayContent = computed(() => {
  if (!props.output) return '';
  return formatTaskToolOutput(props.output);
});

const title = computed(() => {
  const description = typeof props.input?.description === 'string' ? props.input.description : '';
  return description || 'Task';
});
</script>

<template>
  <CodeContent :html="displayContent" variant="code" gutter-mode="none" />
</template>
