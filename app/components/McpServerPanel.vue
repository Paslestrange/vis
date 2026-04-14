<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import type { McpServerConfig } from '../composables/useMcpServers';

const props = defineProps<{
  servers: readonly McpServerConfig[];
  statusByName?: Record<string, { status: string; error?: string }>;
}>();

const emit = defineEmits<{
  (event: 'add', config: McpServerConfig): void;
  (event: 'update', name: string, config: Partial<Omit<McpServerConfig, 'name'>>): void;
  (event: 'remove', name: string): void;
  (event: 'connect', name: string): void;
  (event: 'disconnect', name: string): void;
  (event: 'close'): void;
}>();

const editingName = ref<string | null>(null);
const formName = ref('');
const formCommand = ref('');
const formArgs = ref('');
const formEnv = ref('');
const formError = ref('');

const isEditing = computed(() => editingName.value !== null);

function openAdd() {
  editingName.value = null;
  formName.value = '';
  formCommand.value = '';
  formArgs.value = '';
  formEnv.value = '';
  formError.value = '';
}

function openEdit(server: McpServerConfig) {
  editingName.value = server.name;
  formName.value = server.name;
  formCommand.value = server.command;
  formArgs.value = server.args.join(' ');
  formEnv.value = Object.entries(server.env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  formError.value = '';
}

function cancelEdit() {
  editingName.value = null;
  formName.value = '';
  formCommand.value = '';
  formArgs.value = '';
  formEnv.value = '';
  formError.value = '';
}

function parseEnv(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of input.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function handleSubmit() {
  formError.value = '';
  const name = formName.value.trim();
  const command = formCommand.value.trim();
  const args = formArgs.value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const env = parseEnv(formEnv.value);

  if (!name) {
    formError.value = 'Name is required';
    return;
  }
  if (!command) {
    formError.value = 'Command is required';
    return;
  }

  if (editingName.value) {
    emit('update', editingName.value, { command, args, env });
  } else {
    if (props.servers.some((s) => s.name === name)) {
      formError.value = `Server "${name}" already exists`;
      return;
    }
    emit('add', { name, command, args, env });
  }
  cancelEdit();
}

function handleRemove(name: string) {
  if (window.confirm(`Remove MCP server "${name}"?`)) {
    emit('remove', name);
    if (editingName.value === name) cancelEdit();
  }
}

function getStatusColor(status?: string) {
  switch (status) {
    case 'connected':
      return '#22c55e';
    case 'failed':
    case 'error':
      return '#ef4444';
    case 'needs_auth':
      return '#f59e0b';
    default:
      return '#64748b';
  }
}

function getStatusLabel(status?: string) {
  if (!status) return 'unknown';
  return status;
}
</script>

<template>
  <div class="mcp-panel">
          <div class="mcp-panel-body">
            <div class="mcp-servers">
              <div v-if="servers.length === 0" class="mcp-empty">No MCP servers configured.</div>
              <div v-for="server in servers" :key="server.name" class="mcp-server-card">
                <div class="mcp-server-main">
                  <div class="mcp-server-row">
                    <div class="mcp-server-name">{{ server.name }}</div>
                    <div
                      class="mcp-server-status"
                      :style="{ color: getStatusColor(statusByName?.[server.name]?.status) }"
                    >
                      {{ getStatusLabel(statusByName?.[server.name]?.status) }}
                    </div>
                  </div>
                  <div class="mcp-server-command">{{ server.command }} {{ server.args.join(' ') }}</div>
                  <div v-if="statusByName?.[server.name]?.error" class="mcp-server-error">
                    {{ statusByName[server.name].error }}
                  </div>
                </div>
                <div class="mcp-server-actions">
                  <button type="button" class="mcp-action-button" @click="emit('connect', server.name)">
                    Connect
                  </button>
                  <button type="button" class="mcp-action-button" @click="emit('disconnect', server.name)">
                    Disconnect
                  </button>
                  <button type="button" class="mcp-action-button" @click="openEdit(server)">
                    Edit
                  </button>
                  <button type="button" class="mcp-action-button is-danger" @click="handleRemove(server.name)">
                    Remove
                  </button>
                </div>
              </div>
            </div>

            <div v-if="!isEditing" class="mcp-form-toggle">
              <button type="button" class="mcp-primary-button" @click="openAdd">+ Add Server</button>
            </div>

            <form v-else class="mcp-form" @submit.prevent="handleSubmit">
              <div class="mcp-form-title">{{ editingName ? 'Edit Server' : 'Add Server' }}</div>
              <div class="mcp-field"
              >
                <label class="mcp-label">Name</label>
                <input
                  v-model="formName"
                  type="text"
                  class="mcp-input"
                  placeholder="my-server"
                  :disabled="!!editingName"
                  required
                />
              </div>
              <div class="mcp-field">
                <label class="mcp-label">Command</label>
                <input v-model="formCommand" type="text" class="mcp-input" placeholder="npx" required />
              </div>
              <div class="mcp-field"
              >
                <label class="mcp-label"
                >Arguments (space-separated)</label>
                <input
                  v-model="formArgs"
                  type="text"
                  class="mcp-input"
                  placeholder="-y @modelcontextprotocol/server-memory"
                />
              </div>
              <div class="mcp-field">
                <label class="mcp-label">Environment (KEY=VALUE per line)</label>
                <textarea v-model="formEnv" class="mcp-textarea" rows="3" placeholder="API_KEY=secret" />
              </div>
              <div v-if="formError" class="mcp-form-error">{{ formError }}</div>
              <div class="mcp-form-actions"
              >
                <button type="button" class="mcp-secondary-button" @click="cancelEdit">Cancel</button>
                <button type="submit" class="mcp-primary-button">{{ editingName ? 'Save' : 'Add' }}</button>
              </div>
            </form>
          </div>
        </div>
</template>

<style scoped>
.mcp-panel {
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid #334155;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(2, 6, 23, 0.45);
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
}

.mcp-panel-body {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mcp-empty {
  color: #64748b;
  font-size: 12px;
  padding: 12px;
  border: 1px dashed #334155;
  border-radius: 8px;
  text-align: center;
}

.mcp-server-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #1e293b;
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.45);
}

.mcp-server-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mcp-server-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mcp-server-name {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.mcp-server-status {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mcp-server-command {
  font-size: 11px;
  color: #94a3b8;
  word-break: break-all;
}

.mcp-server-error {
  font-size: 11px;
  color: #fecaca;
}

.mcp-server-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mcp-action-button {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 11px;
  cursor: pointer;
}

.mcp-action-button:hover {
  background: #1e293b;
}

.mcp-action-button.is-danger {
  color: #fecaca;
  border-color: rgba(239, 68, 68, 0.5);
}

.mcp-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #1e293b;
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.45);
}

.mcp-form-title {
  font-size: 13px;
  font-weight: 600;
}

.mcp-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mcp-label {
  font-size: 11px;
  color: #94a3b8;
}

.mcp-input,
.mcp-textarea {
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
  font-family: inherit;
  font-size: 12px;
  outline: none;
}

.mcp-input:focus,
.mcp-textarea:focus {
  border-color: #3b82f6;
}

.mcp-textarea {
  resize: vertical;
}

.mcp-form-error {
  font-size: 11px;
  color: #fecaca;
}

.mcp-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.mcp-primary-button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #3b82f6;
  background: rgba(59, 130, 246, 0.15);
  color: #e2e8f0;
  font-size: 12px;
  cursor: pointer;
}

.mcp-primary-button:hover {
  background: rgba(59, 130, 246, 0.25);
}

.mcp-secondary-button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  cursor: pointer;
}

.mcp-secondary-button:hover {
  background: #1e293b;
}

html.theme-light .mcp-panel {
  background: rgba(255, 255, 255, 0.98);
  border-color: #cbd5e1;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  color: #0f172a;
}

html.theme-light .mcp-panel-close {
  border-color: #cbd5e1;
  color: #64748b;
}

html.theme-light .mcp-panel-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

html.theme-light .mcp-empty {
  color: #94a3b8;
  border-color: #cbd5e1;
  background: rgba(248, 250, 252, 0.85);
}

html.theme-light .mcp-server-card {
  border-color: #e2e8f0;
  background: rgba(248, 250, 252, 0.85);
}

html.theme-light .mcp-server-name {
  color: #0f172a;
}

html.theme-light .mcp-server-command {
  color: #64748b;
}

html.theme-light .mcp-server-error {
  color: #ef4444;
}

html.theme-light .mcp-action-button {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
}

html.theme-light .mcp-action-button:hover {
  background: #e2e8f0;
}

html.theme-light .mcp-action-button.is-danger {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.35);
}

html.theme-light .mcp-form {
  border-color: #e2e8f0;
  background: rgba(248, 250, 252, 0.85);
}

html.theme-light .mcp-form-title {
  color: #0f172a;
}

html.theme-light .mcp-label {
  color: #64748b;
}

html.theme-light .mcp-input,
html.theme-light .mcp-textarea {
  border-color: #cbd5e1;
  background: #ffffff;
  color: #0f172a;
}

html.theme-light .mcp-input:focus,
html.theme-light .mcp-textarea:focus {
  border-color: #3b82f6;
}

html.theme-light .mcp-form-error {
  color: #ef4444;
}

html.theme-light .mcp-primary-button {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.12);
  color: #0f172a;
}

html.theme-light .mcp-primary-button:hover {
  background: rgba(59, 130, 246, 0.22);
}

html.theme-light .mcp-secondary-button {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
}

html.theme-light .mcp-secondary-button:hover {
  background: #e2e8f0;
}
</style>
