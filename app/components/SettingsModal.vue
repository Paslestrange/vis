<template>
  <dialog
    ref="dialogRef"
    class="modal-backdrop"
    @close="$emit('close')"
    @cancel.prevent
    @click.self="dialogRef?.close()"
  >
    <div class="modal">
      <header class="modal-header">
        <div class="modal-title">Settings</div>
        <button type="button" class="modal-close-button" @click="dialogRef?.close()">
          <Icon icon="lucide:x" :width="14" :height="14" />
        </button>
      </header>
      <div class="modal-body">
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Enter to send</div>
            <div class="setting-description">
              Send messages by pressing Enter. When off, use Ctrl+Enter.
            </div>
          </div>
          <label class="toggle-switch">
            <input v-model="enterToSend" type="checkbox" class="toggle-input" />
            <span class="toggle-track" />
          </label>
        </div>
<div class="setting-group">
          <div class="setting-label">Theme</div>
          <div class="radio-row">
            <label class="radio-option">
              <input type="radio" :checked="props.themeMode === 'light'" @change="$emit('update:themeMode', 'light')" />
              <span>Light</span>
            </label>
            <label class="radio-option">
              <input type="radio" :checked="props.themeMode === 'dark'" @change="$emit('update:themeMode', 'dark')" />
              <span>Dark</span>
            </label>
            <label class="radio-option">
              <input type="radio" :checked="props.themeMode === 'system'" @change="$emit('update:themeMode', 'system')" />
              <span>System</span>
            </label>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Analytics</div>
            <div class="setting-description">
              Open token usage and cost dashboard (Ctrl+Shift+A).
            </div>
          </div>
          <button type="button" class="action-button" @click="$emit('open-analytics')">
            Open
          </button>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">MCP Servers</div>
            <div class="setting-description">
              Manage configured Model Context Protocol servers.
            </div>
          </div>
          <button type="button" class="settings-action-button" @click="$emit('openMcp')">
            Open
          </button>
        </div>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useSettings } from '../composables/useSettings';

import type { ThemeMode } from '../composables/useTheme';

const props = defineProps<{
  open: boolean;
  themeMode: ThemeMode;
}>();

defineEmits<{
  (event: 'close'): void;
  (event: 'open-analytics'): void;
  (event: 'update:themeMode', mode: ThemeMode): void;
  (event: 'openMcp'): void;
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
const { enterToSend } = useSettings();

watch(
  () => props.open,
  (open) => {
    const el = dialogRef.value;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  },
);
</script>

<style scoped>
.modal-backdrop {
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  color: inherit;
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-backdrop:not([open]) {
  display: none;
}

.modal-backdrop::backdrop {
  background: rgba(2, 6, 23, 0.65);
}

.modal {
  width: min(480px, 95vw);
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

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.modal-title {
  font-size: 14px;
  font-weight: 600;
}

.modal-close-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #334155;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.modal-close-button:hover {
  background: #1e293b;
  color: #e2e8f0;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border: 1px solid #1e293b;
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.45);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  color: #e2e8f0;
}

.setting-description {
  font-size: 11px;
  color: #64748b;
}

.toggle-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  cursor: pointer;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  width: 36px;
  height: 20px;
  background: #334155;
  border-radius: 10px;
  position: relative;
  transition: background 0.2s;
}

.toggle-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #94a3b8;
  border-radius: 50%;
  transition:
    transform 0.2s,
    background 0.2s;
}

.toggle-input:checked + .toggle-track {
  background: #3b82f6;
}

.toggle-input:checked + .toggle-track::after {
  transform: translateX(16px);
  background: #fff;
}

.action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border: 1px solid #334155;
  border-radius: 6px;
  background: #111a2c;
  color: #e2e8f0;
  font-size: 12px;
  cursor: pointer;
}

.action-button:hover {
  background: #1d2a45;
}

.settings-action-button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}

.settings-action-button:hover {
  background: #1e293b;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #1e293b;
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.45);
}

.radio-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.radio-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #e2e8f0;
  cursor: pointer;
  user-select: none;
}

.radio-option input[type='radio'] {
  accent-color: #3b82f6;
}

html.theme-light .modal {
  background: rgba(255, 255, 255, 0.98);
  border-color: #cbd5e1;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  color: #0f172a;
}

html.theme-light .modal-backdrop::backdrop {
  background: rgba(15, 23, 42, 0.25);
}

html.theme-light .modal-close-button {
  border-color: #cbd5e1;
  color: #64748b;
}

html.theme-light .modal-close-button:hover {
  background: #f1f5f9;
  color: #0f172a;
}

html.theme-light .setting-row {
  border-color: #e2e8f0;
  background: rgba(248, 250, 252, 0.85);
}

html.theme-light .setting-label {
  color: #0f172a;
}

html.theme-light .setting-description {
  color: #94a3b8;
}

html.theme-light .action-button {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
}

html.theme-light .action-button:hover {
  background: #e2e8f0;
}

html.theme-light .settings-action-button {
  border-color: #cbd5e1;
  background: #ffffff;
  color: #0f172a;
}

html.theme-light .settings-action-button:hover {
  background: #e2e8f0;
}

html.theme-light .setting-group {
  border-color: #e2e8f0;
  background: rgba(248, 250, 252, 0.85);
}

html.theme-light .radio-option {
  color: #0f172a;
}

html.theme-light .toggle-track {
  background: #cbd5e1;
}

html.theme-light .toggle-track::after {
  background: #64748b;
}
</style>
