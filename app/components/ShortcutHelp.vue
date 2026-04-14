
<template>
  <div class="modal">
    <div class="modal-body">
        <div class="shortcut-group">
          <div class="shortcut-row">
            <kbd class="shortcut-key">Ctrl</kbd>
            <span class="shortcut-plus">+</span>
            <kbd class="shortcut-key">;</kbd>
            <span class="shortcut-desc">New session</span>
          </div>
          <div class="shortcut-row">
            <kbd class="shortcut-key">Ctrl</kbd>
            <span class="shortcut-plus">+</span>
            <kbd class="shortcut-key">G</kbd>
            <span class="shortcut-desc">Toggle session dropdown</span>
          </div>
          <div class="shortcut-row">
            <kbd class="shortcut-key">Alt</kbd>
            <span class="shortcut-plus">+</span>
            <kbd class="shortcut-key">N</kbd>
            <span class="shortcut-desc">New session</span>
          </div>
          <div class="shortcut-row">
            <kbd class="shortcut-key">Alt</kbd>
            <span class="shortcut-plus">+</span>
            <kbd class="shortcut-key">O</kbd>
            <span class="shortcut-desc">Open shell</span>
          </div>
          <div class="shortcut-row">
            <kbd class="shortcut-key">Alt</kbd>
            <span class="shortcut-plus">+</span>
            <kbd class="shortcut-key">←</kbd>
            <span class="shortcut-desc">Previous session</span>
          </div>
          <div class="shortcut-row">
            <kbd class="shortcut-key">Alt</kbd>
            <span class="shortcut-plus">+</span>
            <kbd class="shortcut-key">→</kbd>
            <span class="shortcut-desc">Next session</span>
          </div>
          <div class="shortcut-row">
            <kbd class="shortcut-key">Alt</kbd>
            <span class="shortcut-plus">+</span>
            <kbd class="shortcut-key">↑</kbd>
            <span class="shortcut-desc">Previous project</span>
          </div>
          <div class="shortcut-row">
            <kbd class="shortcut-key">Alt</kbd>
            <span class="shortcut-plus">+</span>
            <kbd class="shortcut-key">↓</kbd>
            <span class="shortcut-desc">Next project</span>
          </div>
          <div class="shortcut-row">
            <kbd class="shortcut-key">Esc</kbd>
            <span class="shortcut-desc">Abort run (double-tap)</span>
          </div>
          <div class="shortcut-row">
            <kbd class="shortcut-key">?</kbd>
            <span class="shortcut-desc">Show shortcuts</span>
          </div>
          <div class="shortcut-row">
            <kbd class="shortcut-key">Ctrl</kbd>
            <span class="shortcut-plus">+</span>
            <kbd class="shortcut-key">/</kbd>
            <span class="shortcut-desc">Show shortcuts</span>
          </div>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineEmits<{
  (event: 'close'): void;
}>();
</script>

<style scoped>
.modal {
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

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  min-height: 24px;
}

.shortcut-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 5px;
  border: 1px solid #334155;
  border-bottom-color: #1e293b;
  border-radius: 5px;
  background: #1e293b;
  color: #e2e8f0;
  font-size: 11px;
  font-family: inherit;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
}

.shortcut-plus {
  color: #64748b;
}

.shortcut-desc {
  color: #94a3b8;
  margin-left: 8px;
}

html.theme-light .modal {
  background: rgba(255, 255, 255, 0.98);
  border-color: #cbd5e1;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  color: #0f172a;
}

html.theme-light .shortcut-key {
  border-color: #cbd5e1;
  border-bottom-color: #e2e8f0;
  background: #f1f5f9;
  color: #0f172a;
}

html.theme-light .shortcut-plus {
  color: #94a3b8;
}

html.theme-light .shortcut-desc {
  color: #64748b;
}
</style>
