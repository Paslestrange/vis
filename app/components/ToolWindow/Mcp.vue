<script setup lang="ts">
import { computed } from 'vue';
import CodeContent from '../CodeContent.vue';

const props = defineProps<{
  html: string;
  status?: string;
  server?: string;
  tool?: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
}>();

const argsText = computed(() => {
  if (!props.arguments || Object.keys(props.arguments).length === 0) return '';
  try {
    return JSON.stringify(props.arguments, null, 2);
  } catch {
    return String(props.arguments);
  }
});

const resultText = computed(() => {
  if (props.result === undefined) return '';
  try {
    return JSON.stringify(props.result, null, 2);
  } catch {
    return String(props.result);
  }
});
</script>

<template>
  <div v-if="status === 'running'" class="tool-placeholder">
    <div v-if="server">Server: {{ server }}</div>
    <div v-if="tool">Tool: {{ tool }}</div>
    <div v-if="argsText">Arguments: {{ argsText }}</div>
    <div v-if="!server && !tool">Calling MCP tool...</div>
  </div>
  <div v-else class="mcp-result">
    <div v-if="server || tool" class="mcp-header">
      <div v-if="server" class="mcp-meta"><span class="mcp-label">Server</span> {{ server }}</div>
      <div v-if="tool" class="mcp-meta"><span class="mcp-label">Tool</span> {{ tool }}</div>
    </div>
    <div v-if="argsText" class="mcp-section">
      <div class="mcp-section-title">Arguments</div>
      <pre class="mcp-code">{{ argsText }}</pre>
    </div>
    <div v-if="resultText" class="mcp-section">
      <div class="mcp-section-title">Result</div>
      <pre class="mcp-code">{{ resultText }}</pre>
    </div>
    <CodeContent v-if="html && !resultText" :html="html" variant="code" />
  </div>
</template>

<style scoped>
.tool-placeholder {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #94a3b8;
  padding: 4px;
  white-space: pre-wrap;
}

.mcp-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px;
}

.mcp-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.35);
}

.mcp-meta {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: #e2e8f0;
  word-break: break-all;
}

.mcp-label {
  display: inline-block;
  min-width: 56px;
  color: #94a3b8;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mcp-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mcp-section-title {
  font-size: 11px;
  font-weight: 600;
  color: #cbd5e1;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mcp-code {
  margin: 0;
  padding: 8px;
  border-radius: 6px;
  background: rgba(2, 6, 23, 0.55);
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
