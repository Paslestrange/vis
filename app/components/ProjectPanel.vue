<template>
  <aside class="project-panel" :class="{ 'is-collapsed': collapsed }">
    <button
      v-if="collapsed"
      type="button"
      class="project-toggle project-toggle-collapsed"
      :aria-expanded="!collapsed"
      aria-label="Expand project panel"
      @click="emit('toggle-collapse')"
    >
      <Icon icon="lucide:chevron-right" width="14" height="14" />
    </button>
    <div v-else class="project-panel-body">
      <div class="project-panel-header">
        <span class="project-panel-title">Projects</span>
        <button
          type="button"
          class="project-toggle project-toggle-inline"
          :aria-expanded="!collapsed"
          aria-label="Collapse project panel"
          @click="emit('toggle-collapse')"
        >
          <Icon icon="lucide:chevron-left" width="14" height="14" />
        </button>
      </div>

      <div class="project-list">
        <div
          v-for="worktree in treeData"
          :key="worktree.projectId"
          class="project-group"
        >
          <div class="project-group-header">
            <span class="project-group-name">{{ worktree.name || worktree.label || 'Project' }}</span>
          </div>
          <div
            v-for="sandbox in worktree.sandboxes"
            :key="sandbox.directory"
            class="sandbox-group"
          >
            <div class="sandbox-header">
              <Icon icon="lucide:git-branch" :width="12" :height="12" />
              <span class="sandbox-name">{{ sandbox.branch || directoryBasename(sandbox.directory) }}</span>
            </div>
            <button
              v-for="session in sandbox.sessions.filter((s) => !s.archivedAt)"
              :key="session.id"
              type="button"
              class="session-row"
              :class="{ 'is-active': session.id === selectedSessionId }"
              @click="handleSelectSession(worktree.projectId, worktree.directory, sandbox.directory, session.id)"
            >
              <span class="session-status-dot" :class="session.status"></span>
              <span class="session-name">{{ session.title || session.slug || session.id }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

interface TopPanelSession {
  id: string;
  title?: string;
  slug?: string;
  status?: 'busy' | 'idle' | 'retry' | 'unknown';
  archivedAt?: number;
}

interface TopPanelSandbox {
  directory: string;
  branch?: string;
  sessions: TopPanelSession[];
}

interface TopPanelWorktree {
  projectId: string;
  directory: string;
  name?: string;
  label?: string;
  sandboxes: TopPanelSandbox[];
}

const props = defineProps<{
  collapsed: boolean;
  treeData: TopPanelWorktree[];
  selectedSessionId: string;
  selectedProjectId: string;
}>();

const emit = defineEmits<{
  (event: 'toggle-collapse'): void;
  (event: 'select-session', payload: {
    projectId: string;
    worktree: string;
    directory: string;
    sessionId: string;
  }): void;
}>();

function directoryBasename(directory: string): string {
  const parts = directory.split('/');
  return parts[parts.length - 1] || directory;
}

function handleSelectSession(projectId: string, worktree: string, directory: string, sessionId: string) {
  emit('select-session', { projectId, worktree, directory, sessionId });
}
</script>

<style scoped>
.project-panel {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid #334155;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.project-panel.is-collapsed {
  background: transparent;
  border: none;
  align-items: center;
  justify-content: center;
}

.project-panel-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.project-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.project-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.project-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.project-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
}

.project-toggle-collapsed {
  width: 28px;
  height: 28px;
  border: 1px solid #334155;
  background: rgba(15, 23, 42, 0.6);
}

.project-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.project-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.project-group-header {
  padding: 4px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.project-group-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sandbox-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sandbox-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  font-size: 11px;
  color: #94a3b8;
}

.sandbox-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #cbd5e1;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  width: 100%;
}

.session-row:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
}

.session-row.is-active {
  background: rgba(59, 130, 246, 0.15);
  color: #dbeafe;
}

.session-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #64748b;
}

.session-status-dot.busy {
  background: #f59e0b;
}

.session-status-dot.idle {
  background: #22c55e;
}

.session-status-dot.retry {
  background: #ef4444;
}

.session-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

html.theme-light .project-panel {
  background: rgba(255, 255, 255, 0.95);
  border-color: #cbd5e1;
}

html.theme-light .project-panel-title {
  color: #0f172a;
}

html.theme-light .project-toggle {
  color: #64748b;
}

html.theme-light .project-toggle:hover {
  color: #0f172a;
}

html.theme-light .project-group-header {
  color: #94a3b8;
}

html.theme-light .sandbox-header {
  color: #64748b;
}

html.theme-light .session-row {
  color: #475569;
}

html.theme-light .session-row:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #0f172a;
}

html.theme-light .session-row.is-active {
  background: rgba(59, 130, 246, 0.1);
  color: #1e40af;
}
</style>
