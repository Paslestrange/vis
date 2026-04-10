<script setup lang="ts">
import { computed } from 'vue';

type McpPermissionRequest = {
  id: string;
  sessionID: string;
  server: string;
  tool: string;
  arguments: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

const props = defineProps<{
  request: McpPermissionRequest;
  isSubmitting?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  (event: 'reply', payload: { requestId: string; reply: 'once' | 'always' | 'reject' }): void;
}>();

const argsEntries = computed(() => Object.entries(props.request.arguments ?? {}));
const metaEntries = computed(() => Object.entries(props.request.metadata ?? {}));

function formatInlineValue(value: unknown) {
  if (typeof value === 'string') return trimToLength(value, 140);
  try {
    const compact = JSON.stringify(value);
    return trimToLength(compact ?? String(value), 140);
  } catch {
    return trimToLength(String(value), 140);
  }
}

function trimToLength(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function emitReply(reply: 'once' | 'always' | 'reject') {
  emit('reply', { requestId: props.request.id, reply });
}
</script>

<template>
  <div class="permission-window">
    <div class="permission-header">
      <div class="permission-title">MCP Permission request</div>
      <div class="permission-type">{{ request.server }} / {{ request.tool }}</div>
    </div>
    <div class="permission-summary">
      <div class="permission-row">
        <div class="permission-label">Session</div>
        <div class="permission-value">{{ request.sessionID }}</div>
      </div>
      <div class="permission-row">
        <div class="permission-label">Server</div>
        <div class="permission-value">{{ request.server }}</div>
      </div>
      <div class="permission-row">
        <div class="permission-label">Tool</div>
        <div class="permission-value">{{ request.tool }}</div>
      </div>
    </div>

    <div class="permission-body">
      <div class="permission-section">
        <div class="section-title">Arguments ({{ argsEntries.length }})</div>
        <div v-if="argsEntries.length === 0" class="empty">None</div>
        <div v-for="entry in argsEntries" :key="entry[0]" class="metadata-row">
          <div class="metadata-key">{{ entry[0] }}</div>
          <div class="metadata-value">{{ formatInlineValue(entry[1]) }}</div>
        </div>
      </div>

      <div class="permission-section">
        <div class="section-title">Metadata ({{ metaEntries.length }})</div>
        <div v-if="metaEntries.length === 0" class="empty">None</div>
        <div v-for="entry in metaEntries" :key="entry[0]" class="metadata-row">
          <div class="metadata-key">{{ entry[0] }}</div>
          <div class="metadata-value">{{ formatInlineValue(entry[1]) }}</div>
        </div>
      </div>

      <div v-if="error" class="permission-error">{{ error }}</div>
    </div>

    <div class="permission-actions">
      <button
        type="button"
        class="permission-button is-once"
        :disabled="isSubmitting"
        @click="emitReply('once')"
      >
        Once
      </button>
      <button
        type="button"
        class="permission-button is-always"
        :disabled="isSubmitting"
        @click="emitReply('always')"
      >
        Always
      </button>
      <button
        type="button"
        class="permission-button is-reject"
        :disabled="isSubmitting"
        @click="emitReply('reject')"
      >
        Reject
      </button>
    </div>
  </div>
</template>

<style scoped>
.permission-window {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;
  color: #e2e8f0;
  font-size: 12px;
}

.permission-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.permission-title {
  font-size: 13px;
  font-weight: 700;
}

.permission-type {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: right;
}

.permission-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  padding: 6px 8px;
  background: rgba(15, 23, 42, 0.35);
}

.permission-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.permission-label {
  color: #94a3b8;
  font-size: 11px;
}

.permission-value {
  color: #e2e8f0;
  font-size: 11px;
  word-break: break-all;
}

.permission-body {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.permission-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  padding: 6px 8px;
  background: rgba(2, 6, 23, 0.45);
}

.section-title {
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.metadata-row {
  display: grid;
  grid-template-columns: minmax(72px, auto) 1fr;
  gap: 8px;
  align-items: start;
}

.metadata-key {
  color: #94a3b8;
  font-size: 11px;
}

.metadata-value {
  color: #e2e8f0;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty {
  color: #64748b;
  font-size: 11px;
}

.permission-error {
  color: #fecaca;
  font-size: 11px;
}

.permission-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  padding-top: 8px;
}

.permission-button {
  border-radius: 8px;
  padding: 6px 10px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 11px;
  cursor: pointer;
}

.permission-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.permission-button.is-once {
  background: rgba(14, 116, 144, 0.25);
  border-color: rgba(14, 116, 144, 0.7);
}

.permission-button.is-always {
  background: rgba(34, 197, 94, 0.18);
  border-color: rgba(34, 197, 94, 0.6);
}

.permission-button.is-reject {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.6);
}

html.theme-light .permission-window {
  color: #0f172a;
}

html.theme-light .permission-type {
  color: #64748b;
}

html.theme-light .permission-summary {
  border-color: rgba(148, 163, 184, 0.25);
  background: rgba(241, 245, 249, 0.7);
}

html.theme-light .permission-label {
  color: #64748b;
}

html.theme-light .permission-value {
  color: #0f172a;
}

html.theme-light .permission-section {
  border-color: rgba(148, 163, 184, 0.25);
  background: rgba(248, 250, 252, 0.85);
}

html.theme-light .section-title {
  color: #475569;
}

html.theme-light .metadata-key {
  color: #64748b;
}

html.theme-light .metadata-value {
  color: #0f172a;
}

html.theme-light .empty {
  color: #94a3b8;
}

html.theme-light .permission-error {
  color: #ef4444;
}

html.theme-light .permission-actions {
  border-top-color: rgba(148, 163, 184, 0.25);
}

html.theme-light .permission-button {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
}

html.theme-light .permission-button.is-once {
  background: rgba(14, 165, 233, 0.12);
  border-color: rgba(14, 165, 233, 0.5);
}

html.theme-light .permission-button.is-always {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.45);
}

html.theme-light .permission-button.is-reject {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.45);
}
</style>
