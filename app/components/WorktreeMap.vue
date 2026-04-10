<template>
  <div class="worktree-map">
    <div class="worktree-header">
      <span class="worktree-title">Worktrees</span>
      <Dropdown
        v-model:open="branchDropdownOpen"
        class="worktree-create-dropdown"
        auto-close
        :popup-style="{ width: '260px' }"
        @select="onCreateFromBranch"
      >
        <template #trigger>
          <button
            type="button"
            class="worktree-create-btn"
            title="Create worktree from branch"
            @click="branchDropdownOpen = !branchDropdownOpen"
          >
            <Icon icon="lucide:git-branch-plus" :width="13" :height="13" />
            From branch
          </button>
        </template>
        <DropdownSearch v-model="branchSearchQuery" placeholder="Search branches" />
        <div v-if="branchListLoading" class="worktree-dropdown-empty">Loading branches...</div>
        <template v-else>
          <DropdownLabel v-if="filteredLocalBranches.length > 0">Local</DropdownLabel>
          <DropdownItem
            v-for="entry in filteredLocalBranches"
            :key="entry.refname"
            :value="entry.displayName"
          >
            <span class="worktree-dropdown-branch">{{ entry.displayName }}</span>
          </DropdownItem>
          <div v-if="!hasFilteredBranches" class="worktree-dropdown-empty">No branches found.</div>
        </template>
      </Dropdown>
      <button
        type="button"
        class="worktree-refresh-btn"
        title="Refresh worktrees"
        @click="emit('refresh')"
      >
        <Icon icon="lucide:refresh-cw" :width="13" :height="13" />
      </button>
    </div>
    <div v-if="loading" class="worktree-empty">Loading worktrees...</div>
    <div v-else-if="worktrees.length === 0" class="worktree-empty">No worktrees found.</div>
    <div v-else class="worktree-list">
      <div
        v-for="worktree in worktrees"
        :key="worktree.directory"
        class="worktree-card"
        :class="{ 'is-active': worktree.isActive }"
      >
        <div class="worktree-card-header">
          <div class="worktree-branch">
            <Icon icon="lucide:git-branch" :width="12" :height="12" />
            <span class="worktree-branch-name" :title="worktree.branch">{{ worktree.branch }}</span>
          </div>
          <div class="worktree-badges">
            <span
              v-if="worktree.dirtyState !== 'clean'"
              class="worktree-badge"
              :class="`is-${worktree.dirtyState}`"
            >
              {{ dirtyLabel(worktree.dirtyState) }}
            </span>
            <span v-if="worktree.ahead > 0" class="worktree-badge is-ahead">
              <Icon icon="lucide:arrow-up" :width="10" :height="10" />
              {{ worktree.ahead }}
            </span>
            <span v-if="worktree.behind > 0" class="worktree-badge is-behind">
              <Icon icon="lucide:arrow-down" :width="10" :height="10" />
              {{ worktree.behind }}
            </span>
            <span v-if="worktree.isMain" class="worktree-badge is-main">MAIN</span>
          </div>
        </div>
        <div class="worktree-directory" :title="worktree.directory">{{ shortDirectory(worktree.directory) }}</div>
        <div class="worktree-actions">
          <button
            type="button"
            class="worktree-action-btn is-switch"
            :disabled="worktree.isActive"
            @click="emit('switch-worktree', worktree.directory)"
          >
            <Icon icon="lucide:arrow-right-left" :width="12" :height="12" />
            Switch
          </button>
          <button
            v-if="!worktree.isMain"
            type="button"
            class="worktree-action-btn is-delete"
            @click="confirmDelete(worktree.directory)"
          >
            <Icon icon="lucide:trash-2" :width="12" :height="12" />
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import Dropdown from './Dropdown.vue';
import DropdownItem from './Dropdown/Item.vue';
import DropdownLabel from './Dropdown/Label.vue';
import DropdownSearch from './Dropdown/Search.vue';
import type { BranchEntry } from '../composables/useFileTree';
import type { WorktreeItem } from '../composables/useWorktrees';

const props = defineProps<{
  worktrees: WorktreeItem[];
  loading: boolean;
  branchEntries?: BranchEntry[];
  branchListLoading?: boolean;
  homePath?: string;
}>();

const emit = defineEmits<{
  (event: 'switch-worktree', directory: string): void;
  (event: 'delete-worktree', directory: string): void;
  (event: 'create-worktree-from-branch', branch: string): void;
  (event: 'refresh'): void;
}>();

const branchDropdownOpen = ref(false);
const branchSearchQuery = ref('');

const filteredLocalBranches = computed(() => {
  const query = branchSearchQuery.value.trim().toLowerCase();
  const locals = (props.branchEntries ?? []).filter((entry) => entry.isLocal);
  if (!query) return locals.slice(0, 8);
  return locals
    .filter((entry) => entry.displayName.toLowerCase().includes(query))
    .slice(0, 8);
});

const hasFilteredBranches = computed(() => filteredLocalBranches.value.length > 0);

function onCreateFromBranch(branch: unknown) {
  if (typeof branch === 'string' && branch) {
    emit('create-worktree-from-branch', branch);
  }
}

function dirtyLabel(state: WorktreeItem['dirtyState']) {
  if (state === 'modified') return 'modified';
  if (state === 'staged') return 'staged';
  return 'clean';
}

function shortDirectory(directory: string) {
  const normalizedHome = (props.homePath ?? '').replace(/\/+$/, '');
  const normalizedDir = directory.replace(/\/+$/, '');
  if (!normalizedHome || !normalizedDir.startsWith('/')) return normalizedDir;
  if (normalizedDir === normalizedHome) return '~';
  const prefix = `${normalizedHome}/`;
  if (normalizedDir.startsWith(prefix)) {
    return `~/${normalizedDir.slice(prefix.length)}`;
  }
  return normalizedDir;
}

function confirmDelete(directory: string) {
  if (!window.confirm(`Delete worktree at ${shortDirectory(directory)}? This cannot be undone.`)) {
    return;
  }
  emit('delete-worktree', directory);
}
</script>

<style scoped>
.worktree-map {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.worktree-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px 8px;
  border-bottom: 1px solid rgba(100, 116, 139, 0.28);
}

.worktree-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #e2e8f0;
}

.worktree-create-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  padding: 4px 8px;
  border: 1px solid rgba(100, 116, 139, 0.45);
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.92);
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.worktree-create-btn:hover {
  background: rgba(51, 65, 85, 0.95);
  color: #e2e8f0;
}

.worktree-refresh-btn {
  width: 26px;
  height: 26px;
  border: 1px solid rgba(100, 116, 139, 0.45);
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.92);
  color: #cbd5e1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.worktree-refresh-btn:hover {
  background: rgba(51, 65, 85, 0.95);
  color: #e2e8f0;
}

.worktree-empty {
  margin: auto;
  color: rgba(148, 163, 184, 0.9);
  font-size: 12px;
}

.worktree-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.worktree-card {
  border: 1px solid rgba(71, 85, 105, 0.55);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.6);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.worktree-card.is-active {
  border-color: rgba(96, 165, 250, 0.6);
  background: rgba(30, 64, 175, 0.22);
}

.worktree-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.worktree-branch {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #e2e8f0;
  font-size: 12px;
  font-weight: 600;
  min-width: 0;
}

.worktree-branch-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.worktree-badges {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.worktree-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.worktree-badge.is-clean {
  border: 1px solid rgba(74, 222, 128, 0.5);
  color: #86efac;
  background: rgba(22, 163, 74, 0.2);
}

.worktree-badge.is-modified {
  border: 1px solid rgba(250, 204, 21, 0.55);
  color: #fde68a;
  background: rgba(202, 138, 4, 0.22);
}

.worktree-badge.is-staged {
  border: 1px solid rgba(96, 165, 250, 0.55);
  color: #93c5fd;
  background: rgba(37, 99, 235, 0.22);
}

.worktree-badge.is-ahead {
  border: 1px solid rgba(74, 222, 128, 0.45);
  color: #86efac;
  background: rgba(22, 163, 74, 0.18);
}

.worktree-badge.is-behind {
  border: 1px solid rgba(248, 113, 113, 0.45);
  color: #fca5a5;
  background: rgba(220, 38, 38, 0.18);
}

.worktree-badge.is-main {
  border: 1px solid rgba(148, 163, 184, 0.5);
  color: #cbd5e1;
  background: rgba(71, 85, 105, 0.3);
}

.worktree-directory {
  font-size: 11px;
  color: #94a3b8;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.worktree-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.worktree-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 5px;
  border: 1px solid rgba(100, 116, 139, 0.4);
  background: rgba(30, 41, 59, 0.8);
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

.worktree-action-btn:hover:not(:disabled) {
  background: rgba(51, 65, 85, 0.9);
  color: #e2e8f0;
}

.worktree-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.worktree-action-btn.is-delete {
  border-color: rgba(248, 113, 113, 0.5);
  color: #fca5a5;
  background: rgba(220, 38, 38, 0.18);
}

.worktree-action-btn.is-delete:hover {
  background: rgba(220, 38, 38, 0.28);
}

.worktree-dropdown-branch {
  font-size: 12px;
  color: #e2e8f0;
}

.worktree-dropdown-empty {
  padding: 8px;
  font-size: 12px;
  color: #94a3b8;
}
</style>
