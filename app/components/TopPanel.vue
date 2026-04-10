<template>
  <div class="top-panel">
    <div v-if="copyToastVisible" class="copy-toast" role="status" aria-live="polite">Copied!</div>
    <div class="top-row">
      <div class="top-left flex items-center gap-2" :title="gitRevision">
        <img width="48px" height="24px" src="/logo.svg" class="" />
        <div class="font-normal hidden lg:block relative top-0.5">OpenCode Visualizer</div>
      </div>
      <div class="top-center">
        <button
          type="button"
          class="control-button notification-button"
          :class="{ 'has-notifications': notifications.length > 0 }"
          :title="
            notifications.length > 0
              ? `${totalNotificationCount} pending notifications (Ctrl-G x2)`
              : 'No notifications'
          "
          :disabled="notifications.length === 0"
          @click="$emit('select-notification')"
        >
          <Icon
            :icon="notifications.length > 0 ? 'lucide:bell-ring' : 'lucide:bell'"
            :width="16"
            :height="16"
          />
          <span v-if="notifications.length > 0" class="notification-badge">{{
            totalNotificationCount
          }}</span>
        </button>

        <div class="top-fields">
          <!-- Project dropdown -->
          <div class="top-field">
            <Dropdown
              v-model:open="projectDropdownOpen"
              class="project-dropdown-root tree-dropdown-root"
              :label="selectedProjectLabel"
              placeholder="Select project"
              title="Select project"
              auto-close
              @select="onProjectSelect"
            >
              <template #label>
                <span v-if="selectedProjectDisplay" class="selected-label">
                  <Icon
                    :icon="selectedProjectDisplay.icon"
                    :width="14"
                    :height="14"
                  />
                  <span class="selected-title">{{ selectedProjectDisplay.name }}</span>
                </span>
                <span v-else class="selected-title">Select project</span>
              </template>
              <template #default="{ close }">
                <div class="dropdown-list">
                  <div v-if="treeData.length === 0" class="dropdown-empty">No projects</div>
                  <DropdownItem
                    v-for="worktree in treeData"
                    :key="worktree.directory"
                    :value="worktree.directory"
                    :active="worktree.directory === projectDirectory"
                  >
                    <div class="dropdown-item-main">
                      <Icon
                        :icon="worktree.projectId === 'global' ? 'lucide:globe' : 'lucide:package'"
                        class="dropdown-item-icon"
                        :width="14"
                        :height="14"
                      />
                      <span class="dropdown-item-label">{{
                        worktree.name || directoryBasename(worktree.directory)
                      }}</span>
                    </div>
                    <div class="dropdown-actions">
                      <button
                        v-if="worktree.projectId && worktree.projectId !== 'global'"
                        type="button"
                        class="tree-action-button worktree-settings"
                        title="Project settings"
                        @click.stop="
                          $emit('edit-project', {
                            projectId: worktree.projectId,
                            worktree: worktree.directory,
                          });
                          close();
                        "
                      >
                        <Icon icon="lucide:settings" :width="14" :height="14" />
                      </button>
                    </div>
                  </DropdownItem>
                </div>
                <div class="dropdown-footer">
                  <button
                    type="button"
                    class="dropdown-footer-button"
                    @click="handleOpenDirectory(close)"
                  >
                    <Icon icon="lucide:folder-open" :width="14" :height="14" />
                    Open project…
                  </button>
                </div>
              </template>
            </Dropdown>
          </div>

          <!-- Worktree dropdown -->
          <div class="top-field">
            <Dropdown
              v-model:open="worktreeDropdownOpen"
              class="worktree-dropdown-root tree-dropdown-root"
              :label="selectedWorktreeLabel"
              placeholder="Select worktree"
              title="Select worktree"
              :disabled="!projectDirectory"
              auto-close
              @select="onWorktreeSelect"
            >
              <template #label>
                <span v-if="selectedWorktreeDisplay" class="selected-label">
                  <Icon
                    :icon="selectedWorktreeDisplay.icon"
                    :width="14"
                    :height="14"
                  />
                  <span class="selected-title">{{ selectedWorktreeDisplay.branch }}</span>
                </span>
                <span v-else class="selected-title">Select worktree</span>
              </template>
              <template #default="{ close }">
                <div class="dropdown-list">
                  <div v-if="currentSandboxes.length === 0" class="dropdown-empty">
                    No worktrees
                  </div>
                  <DropdownItem
                    v-for="sandbox in currentSandboxes"
                    :key="sandbox.directory"
                    :value="sandbox.directory"
                    :active="sandbox.directory === activeDirectory"
                  >
                    <div class="dropdown-item-main">
                      <Icon
                        :icon="
                          currentWorktree?.projectId === 'global'
                            ? 'lucide:folder'
                            : 'lucide:git-branch'
                        "
                        class="dropdown-item-icon"
                        :width="14"
                        :height="14"
                      />
                      <span class="dropdown-item-label">{{
                        sandbox.branch || directoryBasename(sandbox.directory)
                      }}</span>
                    </div>
                    <div class="dropdown-actions">
                      <button
                        v-if="sandbox.branch"
                        type="button"
                        class="dropdown-copy"
                        @click.stop="copyBranch(sandbox.branch)"
                      >
                        Copy
                      </button>
                      <span v-else class="dropdown-action-placeholder"></span>
                      <button
                        v-if="canDeleteSandbox(sandbox.directory, currentWorktree?.directory ?? '')"
                        type="button"
                        class="dropdown-delete"
                        @click.stop="handleSandboxDelete(sandbox.directory, close)"
                      >
                        Delete
                      </button>
                      <span v-else class="dropdown-action-placeholder"></span>
                    </div>
                  </DropdownItem>
                </div>
              </template>
            </Dropdown>
            <button
              type="button"
              class="control-button"
              :disabled="!projectDirectory"
              @click="$emit('create-worktree-from', projectDirectory)"
              title="Create a new sandbox"
            >
              <Icon icon="lucide:git-branch-plus" :width="14" :height="14" />
            </button>
          </div>

          <!-- Session dropdown -->
          <div class="top-field">
            <Dropdown
              v-model:open="sessionDropdownOpen"
              class="session-dropdown-root tree-dropdown-root"
              :label="dropdownLabel"
              placeholder="Select session"
              title="Select session (Ctrl-G)"
              :disabled="!activeDirectory"
              auto-close
              :popup-style="{ minWidth: '380px', width: 'min(520px, 90vw)', maxWidth: '90vw' }"
              popup-class="max-lg:left-0! max-lg:w-screen! max-lg:min-w-0! max-lg:max-w-none!"
              @select="onSessionSelect"
            >
              <template #label>
                <span v-if="selectedDisplay" class="selected-label">
                  <span class="selected-status-icon">{{
                    sessionStatusIcon(selectedDisplay.status)
                  }}</span>
                  <span class="selected-title">{{ selectedDisplay.title }}</span>
                  <span class="selected-branch-badge">
                    <Icon icon="lucide:git-branch" :width="11" :height="11" />
                    {{ selectedDisplay.branch }}
                  </span>
                </span>
                <span v-else class="selected-title">Select session</span>
              </template>
              <template #default="{ close }">
                <div class="session-menu">
                  <DropdownSearch
                    v-model="searchQuery"
                    placeholder="Search sessions..."
                    class="session-search tree-search"
                  >
                    <template #before>
                      <Icon icon="lucide:search" class="search-icon" />
                    </template>
                    <template #after>
                      <button
                        v-if="searchQuery"
                        type="button"
                        class="clear-search"
                        @click.stop="searchQuery = ''"
                      >
                        <Icon icon="lucide:x" />
                      </button>
                    </template>
                  </DropdownSearch>

                  <div class="session-list tree-content">
                    <div v-if="displayedSessions.length === 0" class="session-empty tree-empty">
                      {{ searchQuery ? 'No matching sessions' : 'No sessions' }}
                    </div>

                    <div
                      v-for="session in displayedSessions"
                      :key="session.id"
                      class="session-row tree-session-row"
                    >
                      <DropdownItem
                        :href="sessionShareHref(currentWorktree?.projectId, session.id)"
                        :value="session.id"
                        :active="session.id === selectedSessionId"
                      >
                        <div class="tree-session-main">
                          <span class="session-status-icon" :title="session.status">{{
                            sessionStatusIcon(session.status)
                          }}</span>
                          <div class="session-info">
                            <div class="session-info-top">
                              <span class="session-title">{{
                                session.title || session.slug || session.id
                              }}</span>
                              <span v-if="session.archivedAt" class="session-badge-archived"
                                >archived</span
                              >
                            </div>
                            <div
                              v-if="sessionTags[session.id]?.length"
                              class="session-tag-chips"
                            >
                              <span
                                v-for="tag in sessionTags[session.id]"
                                :key="tag"
                                class="session-tag-chip"
                                >{{ tag }}</span
                              >
                            </div>
                            <span
                              v-if="session.timeCreated || session.timeUpdated"
                              class="session-time"
                            >
                              {{ formatSessionMetaTime(session) }}
                            </span>
                          </div>
                        </div>
                        <div class="session-actions">
                          <button
                            type="button"
                            class="tree-action-button favourite"
                            :class="{ 'is-favourite': sessionFavourites[session.id] }"
                            :title="sessionFavourites[session.id] ? 'Unfavourite' : 'Favourite'"
                            @click.stop.prevent="emit('toggle-favourite', session.id)"
                          >
                            <Icon icon="lucide:star" :width="14" :height="14" />
                          </button>
                          <button
                            type="button"
                            class="tree-action-button tag-toggle"
                            :class="{ active: tagEditorSessionId === session.id }"
                            title="Edit tags"
                            @click.stop.prevent="
                              tagEditorSessionId =
                                tagEditorSessionId === session.id ? null : session.id
                            "
                          >
                            <Icon icon="lucide:tag" :width="14" :height="14" />
                          </button>
                          <Dropdown
                            class="session-export-dropdown"
                            :auto-close="true"
                            :popup-style="{ width: '160px', left: 'auto', right: 'anchor(right)' }"
                            @select="
                              (value: unknown) => handleExportSelect(value as string, session.id)
                            "
                          >
                            <template #trigger>
                              <button
                                type="button"
                                class="tree-action-button export"
                                title="Export transcript"
                                @click.stop.prevent
                              >
                                <Icon icon="lucide:download" :width="14" :height="14" />
                              </button>
                            </template>
                            <DropdownItem value="markdown">
                              <span class="menu-item-content">
                                <Icon icon="lucide:file-down" :width="14" :height="14" />
                                Export Markdown
                              </span>
                            </DropdownItem>
                            <DropdownItem value="json">
                              <span class="menu-item-content">
                                <Icon icon="lucide:file-json" :width="14" :height="14" />
                                Export JSON
                              </span>
                            </DropdownItem>
                          </Dropdown>
                          <button
                            v-if="!session.archivedAt"
                            type="button"
                            class="tree-action-button session-del"
                            :class="isShiftPressed ? 'danger' : 'archive'"
                            :title="
                              isShiftPressed
                                ? 'Delete session permanently'
                                : 'Archive session (with Shift key to delete permanently)'
                            "
                            @click.stop.prevent="handleSessionAction(session.id, close)"
                          >
                            <Icon
                              :icon="isShiftPressed ? 'lucide:trash-2' : 'lucide:archive'"
                              :width="16"
                              :height="16"
                            />
                          </button>
                        </div>
                      </DropdownItem>
                      <div
                        v-if="tagEditorSessionId === session.id"
                        class="session-tag-editor"
                        @click.stop
                      >
                        <SessionTagInput
                          :tags="sessionTags[session.id] ?? []"
                          :all-tags="allTags"
                          @update:tags="(tags: string[]) => emit('update-tags', session.id, tags)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </Dropdown>
            <button
              type="button"
              class="control-button new-session-button"
              :disabled="!selectedSessionId"
              @click="$emit('new-session')"
              title="New session (Ctrl-;)"
            >
              <Icon icon="lucide:message-circle-plus" :width="16" :height="16" />
            </button>
          </div>
        </div>

        <button
          type="button"
          class="control-button open-shell-button"
          :disabled="!activeDirectory"
          @click="$emit('open-shell')"
          title="Open shell"
        >
          <Icon icon="lucide:terminal" :width="16" :height="16" />
        </button>
      </div>
      <div class="top-right">
        <a
          href="https://github.com/Paslestrange/vis/"
          target="_blank"
          rel="noopener noreferrer"
          class="control-button github-button"
          title="GitHub"
        >
          <Icon icon="lucide:github" :width="16" :height="16" />
        </a>
        <Dropdown
          v-model:open="menuOpen"
          auto-close
          :popup-style="{ width: '160px', left: 'auto', right: 'anchor(right)' }"
          @select="onMenuSelect"
        >
          <template #trigger>
            <button
              type="button"
              class="control-button menu-button"
              @click.stop="menuOpen = !menuOpen"
            >
              <Icon icon="lucide:ellipsis-vertical" :width="16" :height="16" />
            </button>
          </template>
          <DropdownItem value="settings">
            <span class="menu-item-content">
              <Icon icon="lucide:settings" :width="14" :height="14" />
              Settings
            </span>
          </DropdownItem>
          <DropdownItem value="logout">
            <span class="menu-item-content">
              <Icon icon="lucide:log-out" :width="14" :height="14" />
              Logout
            </span>
          </DropdownItem>
        </Dropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import Dropdown from './Dropdown.vue';
import DropdownItem from './Dropdown/Item.vue';
import DropdownSearch from './Dropdown/Search.vue';
import SessionTagInput from './SessionTagInput.vue';

declare const __GIT_REVISION__: string;
const gitRevision = typeof __GIT_REVISION__ !== 'undefined' ? __GIT_REVISION__ : 'dev';

export type TopPanelSession = {
  id: string;
  title?: string;
  slug?: string;
  status: 'busy' | 'idle' | 'retry' | 'unknown';
  timeCreated?: number;
  timeUpdated?: number;
  archivedAt?: number;
};

export type TopPanelSandbox = {
  directory: string;
  branch?: string;
  sessions: TopPanelSession[];
};

export type TopPanelWorktree = {
  directory: string;
  label: string;
  name?: string;
  projectId?: string;
  projectColor?: string;
  sandboxes: TopPanelSandbox[];
};

export type TopPanelNotificationSession = {
  projectId: string;
  sessionId: string;
  count: number;
};

type SessionSelectPayload = {
  projectId?: string;
  worktree: string;
  directory: string;
  sessionId: string;
};

const props = defineProps<{
  treeData: TopPanelWorktree[];
  notificationSessions: TopPanelNotificationSession[];
  projectDirectory: string;
  activeDirectory: string;
  selectedSessionId: string;
  homePath?: string;
  sessionTags: Record<string, string[]>;
  sessionFavourites: Record<string, boolean>;
  sessionSearchContents?: Record<string, string>;
}>();

const notifications = computed(() => props.notificationSessions ?? []);
const totalNotificationCount = computed(() =>
  notifications.value.reduce((sum, item) => sum + item.count, 0),
);

const emit = defineEmits<{
  (event: 'select-notification'): void;
  (event: 'select-session', payload: SessionSelectPayload): void;
  (event: 'create-worktree-from', worktree: string): void;
  (event: 'new-session'): void;
  (event: 'new-session-in', payload: { worktree: string; directory: string }): void;
  (event: 'delete-active-directory', value: string): void;
  (event: 'delete-session', value: string): void;
  (event: 'archive-session', value: string): void;
  (event: 'open-directory'): void;
  (event: 'open-shell'): void;
  (event: 'edit-project', payload: { projectId: string; worktree: string }): void;
  (event: 'open-settings'): void;
  (event: 'logout'): void;
  (event: 'dropdown-closed'): void;
  (event: 'toggle-favourite', sessionId: string): void;
  (event: 'update-tags', sessionId: string, tags: string[]): void;
  (event: 'export-markdown', sessionId: string): void;
  (event: 'export-json', sessionId: string): void;
}>();

const menuOpen = ref(false);
const projectDropdownOpen = ref(false);
const worktreeDropdownOpen = ref(false);
const sessionDropdownOpen = ref(false);
const tagEditorSessionId = ref<string | null>(null);
const searchQuery = ref('');
const isShiftPressed = ref(false);

watch(projectDropdownOpen, (open) => {
  if (open) {
    worktreeDropdownOpen.value = false;
    sessionDropdownOpen.value = false;
  }
});

watch(worktreeDropdownOpen, (open) => {
  if (open) {
    projectDropdownOpen.value = false;
    sessionDropdownOpen.value = false;
  }
});

watch(sessionDropdownOpen, (open) => {
  if (open) {
    projectDropdownOpen.value = false;
    worktreeDropdownOpen.value = false;
    searchQuery.value = '';
  }
  if (!open) {
    tagEditorSessionId.value = null;
    emit('dropdown-closed');
  }
});

function openSessionDropdown() {
  sessionDropdownOpen.value = true;
}

function closeSessionDropdown() {
  sessionDropdownOpen.value = false;
}

function toggleSessionDropdown() {
  sessionDropdownOpen.value = !sessionDropdownOpen.value;
}

defineExpose({ openSessionDropdown, closeSessionDropdown, toggleSessionDropdown });

function onMenuSelect(value: unknown) {
  if (value === 'settings') emit('open-settings');
  else if (value === 'logout') emit('logout');
}

const currentWorktree = computed(() =>
  props.treeData.find((w) => w.directory === props.projectDirectory),
);

const currentSandboxes = computed(() => currentWorktree.value?.sandboxes ?? []);

const currentSandbox = computed(() =>
  currentSandboxes.value.find((s) => s.directory === props.activeDirectory),
);

const currentSessions = computed(() => currentSandbox.value?.sessions ?? []);

const selectedProjectDisplay = computed(() => {
  const w = currentWorktree.value;
  if (!w) return null;
  return {
    name: w.name || directoryBasename(w.directory),
    icon: w.projectId === 'global' ? 'lucide:globe' : 'lucide:package' as string,
  };
});

const selectedProjectLabel = computed(() => selectedProjectDisplay.value?.name || 'Select project');

const selectedWorktreeDisplay = computed(() => {
  const s = currentSandbox.value;
  if (!s) return null;
  return {
    branch: s.branch || directoryBasename(s.directory),
    icon:
      currentWorktree.value?.projectId === 'global'
        ? 'lucide:folder'
        : ('lucide:git-branch' as string),
  };
});

const selectedWorktreeLabel = computed(() => selectedWorktreeDisplay.value?.branch || 'Select worktree');

const selectedDisplay = computed(() => {
  const sid = props.selectedSessionId;
  if (!sid) return null;
  for (const worktree of props.treeData) {
    for (const sandbox of worktree.sandboxes) {
      const session = sandbox.sessions.find((candidate) => candidate.id === sid);
      if (!session) continue;
      const branch = sandbox.branch || directoryBasename(sandbox.directory);
      const title = session.title || session.slug || session.id;
      return { branch, title, status: session.status };
    }
  }
  return { branch: 'unknown', title: sid, status: 'unknown' as const };
});

const dropdownLabel = computed(() => {
  if (!selectedDisplay.value) return 'Select session';
  return `${selectedDisplay.value.branch} / ${selectedDisplay.value.title}`;
});

const allTags = computed(() => {
  const set = new Set<string>();
  for (const tags of Object.values(props.sessionTags ?? {})) {
    for (const tag of tags) {
      set.add(tag);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
});

const displayedSessions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let sessions = currentSessions.value;

  if (query) {
    sessions = sessions.filter((session) => {
      const sessionTagsText = props.sessionTags?.[session.id]?.join(' ') ?? '';
      const sessionContent = props.sessionSearchContents?.[session.id] ?? '';
      return matchesQuery(
        query,
        session.title,
        session.slug,
        session.id,
        session.archivedAt ? 'archived' : undefined,
        session.timeCreated ? formatSessionTime(session.timeCreated) : undefined,
        session.timeUpdated ? formatSessionTime(session.timeUpdated) : undefined,
        sessionTagsText,
        sessionContent,
      );
    });
  } else {
    sessions = sessions.filter((session) => !session.archivedAt);
  }

  return sessions;
});

function onProjectSelect(directory: unknown) {
  if (typeof directory !== 'string') return;
  const worktree = props.treeData.find((w) => w.directory === directory);
  if (!worktree) return;
  const sandbox = worktree.sandboxes[0];
  if (!sandbox) return;
  const session = sandbox.sessions[0];
  if (session) {
    emit('select-session', {
      projectId: worktree.projectId,
      worktree: worktree.directory,
      directory: sandbox.directory,
      sessionId: session.id,
    });
  } else {
    emit('new-session-in', { worktree: worktree.directory, directory: sandbox.directory });
  }
}

function onWorktreeSelect(sandboxDirectory: unknown) {
  if (typeof sandboxDirectory !== 'string') return;
  const sandbox = currentSandboxes.value.find((s) => s.directory === sandboxDirectory);
  if (!sandbox) return;
  const session = sandbox.sessions[0];
  if (session) {
    emit('select-session', {
      projectId: currentWorktree.value?.projectId,
      worktree: currentWorktree.value?.directory || '',
      directory: sandbox.directory,
      sessionId: session.id,
    });
  } else {
    emit('new-session-in', {
      worktree: currentWorktree.value?.directory || '',
      directory: sandbox.directory,
    });
  }
}

function onSessionSelect(sessionId: unknown) {
  if (typeof sessionId !== 'string') return;
  const sandbox = currentSandbox.value;
  if (!sandbox) return;
  const session = sandbox.sessions.find((s) => s.id === sessionId);
  if (!session) return;
  emit('select-session', {
    projectId: currentWorktree.value?.projectId,
    worktree: currentWorktree.value?.directory || '',
    directory: sandbox.directory,
    sessionId: session.id,
  });
}

function matchesQuery(query: string, ...fields: (string | undefined)[]) {
  const terms = query.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return false;
  return terms.every((term) => fields.some((field) => field?.toLowerCase().includes(term)));
}

function sessionShareHref(projectId: string | undefined, sessionId: string) {
  const params = new URLSearchParams();
  const normalizedProjectId = projectId?.trim() ?? '';
  const normalizedSessionId = sessionId.trim();
  if (normalizedProjectId) params.set('project', normalizedProjectId);
  if (normalizedSessionId) params.set('session', normalizedSessionId);
  return `?${params.toString()}`;
}

function directoryBasename(path: string) {
  return path.replace(/\/+$/, '').split('/').pop() ?? '';
}

function sessionStatusIcon(status: TopPanelSession['status']) {
  if (status === 'busy') return '🤔';
  if (status === 'retry') return '🔴';
  if (status === 'idle') return '🟢';
  return '⚪';
}

function formatSessionTime(timestamp: number) {
  const d = new Date(timestamp);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}`;
}

function formatSessionMetaTime(session: TopPanelSession) {
  const created = session.timeCreated ? formatSessionTime(session.timeCreated) : undefined;
  const updated = session.timeUpdated ? formatSessionTime(session.timeUpdated) : undefined;
  if (created && updated) {
    return `Created: ${created} / Updated: ${updated}`;
  }
  if (created) return `Created: ${created}`;
  if (updated) return `Updated: ${updated}`;
  return '';
}

function canDeleteSandbox(directory: string, worktreeDirectory: string) {
  const normalizedDirectory = directory.replace(/\/+$/, '');
  const normalizedWorktree = worktreeDirectory.replace(/\/+$/, '');
  return normalizedDirectory !== normalizedWorktree;
}

function handleExportSelect(format: string, sessionId: string) {
  if (format === 'markdown') emit('export-markdown', sessionId);
  else if (format === 'json') emit('export-json', sessionId);
}

function handleSessionAction(sessionId: string, close?: () => void) {
  if (isShiftPressed.value) {
    handleSessionDelete(sessionId, close);
    return;
  }
  emit('archive-session', sessionId);
}

function handleSessionDelete(sessionId: string, close?: () => void) {
  if (typeof window !== 'undefined') {
    const session = currentSessions.value.find((item) => item.id === sessionId);
    const label = session ? session.title || session.slug || session.id : sessionId;
    const confirmed = window.confirm(`Delete session "${label}"?`);
    if (!confirmed) return;
  }
  emit('delete-session', sessionId);
  close?.();
}

function handleSandboxDelete(directory: string, close?: () => void) {
  if (typeof window !== 'undefined') {
    const confirmed = window.confirm(`Delete worktree "${directory}"?`);
    if (!confirmed) return;
  }
  emit('delete-active-directory', directory);
  close?.();
}

const copyToastVisible = ref(false);
let copyToastTimer: ReturnType<typeof setTimeout> | null = null;

async function copyBranch(branch: string) {
  const text = branch.trim();
  if (!text) return;
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(text);
    showCopyToast();
  } catch {
    return;
  }
}

function showCopyToast() {
  copyToastVisible.value = true;
  if (copyToastTimer) clearTimeout(copyToastTimer);
  copyToastTimer = setTimeout(() => {
    copyToastVisible.value = false;
    copyToastTimer = null;
  }, 1400);
}

onBeforeUnmount(() => {
  if (copyToastTimer) {
    clearTimeout(copyToastTimer);
    copyToastTimer = null;
  }
});

function handleGlobalKeydown(event: KeyboardEvent) {
  isShiftPressed.value = event.shiftKey;
}

function handleGlobalKeyup(event: KeyboardEvent) {
  isShiftPressed.value = event.shiftKey;
}

function resetShiftState() {
  isShiftPressed.value = false;
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('keyup', handleGlobalKeyup);
  window.addEventListener('blur', resetShiftState);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  window.removeEventListener('keyup', handleGlobalKeyup);
  window.removeEventListener('blur', resetShiftState);
});

function handleOpenDirectory(close: () => void) {
  emit('open-directory');
  close();
}
</script>

<style scoped>
.top-panel {
  position: relative;
  width: 100%;
  min-width: 0;
  /* Full-width background band that breaks out of parent padding */
  margin: -12px -12px 0;
  padding: 8px 12px;
  width: calc(100% + 24px);
  background: rgba(15, 23, 42, 0.92);
  border-bottom: 1px solid #334155;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.top-left {
  flex: 0 0 auto;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #f1f5f9;
}

.top-center {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.top-right {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
}

.top-fields {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.top-field {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 340px;
}

.project-dropdown-root,
.worktree-dropdown-root,
.session-dropdown-root {
  flex: 1 1 auto;
  min-width: 0;
}

.session-menu {
  display: flex;
  flex-direction: column;
  background: transparent;
  flex: 1 1 auto;
  min-height: 0;
}

.session-list {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
  padding: 6px 0;
}

.session-empty {
  padding: 14px;
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
}

.dropdown-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 0;
}

.dropdown-empty {
  padding: 14px;
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
}

.dropdown-item-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
}

.dropdown-item-icon {
  flex: 0 0 auto;
  color: #64748b;
}

.dropdown-item-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.dropdown-action-placeholder {
  width: 44px;
  height: 22px;
  flex: 0 0 auto;
}

.dropdown-delete {
  flex: 0 0 auto;
  background: #991b1b;
  color: #fee2e2;
  border: 1px solid #b91c1c;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 10px;
  cursor: pointer;
}

.dropdown-delete:hover {
  background: #b91c1c;
}

.dropdown-copy {
  flex: 0 0 auto;
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 10px;
  cursor: pointer;
}

.dropdown-copy:hover {
  background: #334155;
}

.dropdown-footer {
  flex: 0 0 auto;
  border-top: 1px solid #334155;
  padding: 8px;
  background: #0b1320;
}

.dropdown-footer-button {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #111a2c;
  color: #e2e8f0;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.dropdown-footer-button:hover {
  background: #1d2a45;
}

.copy-toast {
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 120;
  background: #14532d;
  color: #dcfce7;
  border: 1px solid #166534;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11px;
}

.control-button {
  border: 1px solid #334155;
  border-radius: 8px;
  background: #0b1320;
  color: #e2e8f0;
  padding: 6px 12px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.new-session-button {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  padding: 0;
  justify-content: center;
  color: #86efac;
}

.new-session-button:hover,
.open-shell-button:hover {
  background: #1d2a45;
}

.open-shell-button {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  padding: 0;
  justify-content: center;
  color: #c4b5fd;
}

.notification-button {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  padding: 0;
  justify-content: center;
  color: #64748b;
}

.notification-button.has-notifications {
  color: #fbbf24;
}

.notification-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

.tree-dropdown-root {
  flex: 0 1 680px;
  width: min(680px, 70vw);
  min-width: 260px;
}

.project-dropdown-root,
.worktree-dropdown-root {
  max-width: 180px;
}

.session-dropdown-root {
  max-width: 260px;
}

.session-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid #334155;
  background: rgba(15, 23, 42, 0.9);
}

.search-icon {
  width: 14px;
  height: 14px;
  color: #64748b;
}

.session-search :deep(.ui-dropdown-search-input) {
  border-radius: 8px;
  font-size: 12px;
  padding: 6px 8px;
}

.session-search :deep(.ui-dropdown-search-input):focus {
  background: rgba(30, 64, 175, 0.15);
}

.clear-search {
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}

.tree-session-row :deep(.ui-dropdown-item) {
  padding-left: 12px;
  border-radius: 0;
  color: #e2e8f0;
}

.tree-session-row :deep(.ui-dropdown-item:hover),
.tree-session-row :deep(.ui-dropdown-item[aria-selected='true']) {
  background: rgba(30, 41, 59, 0.8);
}

.tree-session-row :deep(.ui-dropdown-item.is-active) {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.45);
}

.tree-session-main {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  column-gap: 8px;
  row-gap: 1px;
  flex: 1 1 auto;
}

.session-status-icon {
  flex: 0 0 auto;
  width: 14px;
  text-align: center;
}

.session-title {
  color: #e2e8f0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.session-info {
  display: contents;
}

.session-info-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}

.session-time {
  font-size: 10px;
  color: #64748b;
  white-space: nowrap;
  flex-basis: 100%;
}

.session-badge-archived {
  flex: 0 0 auto;
  margin-left: auto;
  font-size: 10px;
  line-height: 1;
  color: #c4b5fd;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 999px;
  padding: 2px 6px;
}

.session-tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex-basis: 100%;
}

.session-tag-chip {
  font-size: 10px;
  color: #93c5fd;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 999px;
  padding: 1px 6px;
}

.session-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.tree-action-button.favourite {
  color: #64748b;
}

.tree-action-button.favourite.is-favourite {
  color: #fbbf24;
}

.tree-action-button.tag-toggle {
  color: #93c5fd;
}

.tree-action-button.tag-toggle.active {
  background: #1d2a45;
}

.tree-action-button.export {
  color: #cbd5e1;
}

.session-del {
  flex: 0 0 auto;
  margin-left: auto;
}

.session-tag-editor {
  padding: 8px 8px 8px 12px;
  background: rgba(15, 23, 42, 0.6);
  border-top: 1px solid #334155;
}

.tree-dropdown-root :deep(.ui-dropdown-button) {
  background: #0b1320;
  border-color: #334155;
  color: #e2e8f0;
  box-shadow: none;
}

.tree-dropdown-root :deep(.ui-dropdown-menu) {
  background: #0b1320;
  border: 1px solid #334155;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.selected-label {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.selected-status-icon {
  flex: 0 0 auto;
  width: 14px;
  text-align: center;
  font-size: 12px;
  line-height: 1;
}

.selected-title {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.selected-branch-badge {
  flex: 0 0 auto;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #334155;
  border-radius: 999px;
  padding: 2px 6px;
  color: #cbd5e1;
  background: #111a2c;
  font-size: 11px;
  line-height: 1;
}

.control-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.github-button {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  padding: 0;
  justify-content: center;
  text-decoration: none;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #94a3b8;
}

.github-button:hover {
  background: transparent;
  color: #e2e8f0;
}

.menu-button {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  padding: 0;
  justify-content: center;
  border: none;
  background: transparent;
  color: #94a3b8;
}

.menu-button:hover {
  background: transparent;
  color: #e2e8f0;
}

.menu-item-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #e2e8f0;
}

html.theme-light .top-panel {
  background: rgba(255, 255, 255, 0.92);
  border-bottom-color: #cbd5e1;
}

html.theme-light .top-left {
  color: #0f172a;
}

html.theme-light .tree-dropdown-root :deep(.ui-dropdown-button) {
  background: #ffffff;
  border-color: #cbd5e1;
  color: #0f172a;
}

html.theme-light .tree-dropdown-root :deep(.ui-dropdown-menu) {
  background: #ffffff;
  border-color: #cbd5e1;
}

html.theme-light .tree-search {
  border-bottom-color: #cbd5e1;
  background: rgba(255, 255, 255, 0.9);
}

html.theme-light .tree-search :deep(.ui-dropdown-search-input) {
  color: #0f172a;
}

html.theme-light .tree-search :deep(.ui-dropdown-search-input):focus {
  background: rgba(59, 130, 246, 0.1);
}

html.theme-light .clear-search {
  color: #94a3b8;
}

html.theme-light .tree-empty {
  color: #64748b;
}

html.theme-light .tree-label-name {
  color: #0f172a;
}

html.theme-light .tree-label-type {
  color: #94a3b8;
}

html.theme-light .tree-action-button {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #475569;
}

html.theme-light .tree-action-button:hover {
  background: #e2e8f0;
  color: #0f172a;
}

html.theme-light .tree-action-button.active {
  background: #e2e8f0;
}

html.theme-light .tree-action-button.favourite.is-favourite {
  color: #f59e0b;
}

html.theme-light .tree-session-row :deep(.ui-dropdown-item) {
  color: #0f172a;
}

html.theme-light .tree-session-row :deep(.ui-dropdown-item:hover),
html.theme-light .tree-session-row :deep(.ui-dropdown-item[aria-selected='true']) {
  background: rgba(226, 232, 240, 0.8);
}

html.theme-light .tree-session-row :deep(.ui-dropdown-item.is-active) {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.35);
}

html.theme-light .tree-sandbox:not(:last-child)::before,
html.theme-light .tree-sandbox:not(:last-child)::after {
  border-color: rgba(148, 163, 184, 0.6);
}

html.theme-light .tree-sandbox:last-child::before {
  border-color: rgba(148, 163, 184, 0.6);
}

html.theme-light .tree-session-row:not(:last-child)::before,
html.theme-light .tree-session-row:not(:last-child)::after,
html.theme-light .tree-session-row:last-child::before {
  border-color: rgba(148, 163, 184, 0.5);
}

html.theme-light .session-title {
  color: #0f172a;
}

html.theme-light .session-time {
  color: #94a3b8;
}

html.theme-light .session-badge-archived {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.25);
}

html.theme-light .session-tag-chip {
  color: #2563eb;
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.25);
}

html.theme-light .session-tag-editor {
  background: rgba(241, 245, 249, 0.8);
  border-top-color: #cbd5e1;
}

html.theme-light .tree-footer {
  border-top-color: #cbd5e1;
  background: rgba(241, 245, 249, 0.8);
}

html.theme-light .tree-footer-button {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
}

html.theme-light .tree-footer-button:hover {
  background: #e2e8f0;
}

html.theme-light .control-button {
  border-color: #cbd5e1;
  background: #ffffff;
  color: #0f172a;
}

html.theme-light .control-button:hover {
  background: #f1f5f9;
  color: #0f172a;
}

html.theme-light .selected-branch-badge {
  color: #475569;
  background: #f8fafc;
  border-color: #cbd5e1;
}

html.theme-light .github-button {
  color: #94a3b8;
}

html.theme-light .github-button:hover {
  color: #0f172a;
}

html.theme-light .menu-button {
  color: #94a3b8;
}

html.theme-light .menu-button:hover {
  color: #0f172a;
}

html.theme-light .menu-item-content {
  color: #0f172a;
}
</style>
