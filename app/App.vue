<template>
  <div ref="appEl" class="app">
    <template v-if="uiInitState === 'ready'">
      <header class="app-header">
        <TopPanel
          ref="topPanelRef"
          :tree-data="topPanelTreeData"
          :notification-sessions="notificationSessions"
          :project-directory="projectDirectory"
          :active-directory="activeDirectory"
          :selected-session-id="selectedSessionId"
          :home-path="homePath"
          :session-tags="sessionTags"
          :session-favourites="sessionFavourites"
          :session-search-contents="sessionContentCache"
          @select-notification="handleNotificationClick"
          @create-worktree-from="createWorktreeFromWorktree"
          @new-session="createNewSession"
          @new-session-in="handleNewSessionInSandbox"
          @open-shell="shellManager.openShellFromInput('')"
          @delete-active-directory="deleteWorktree"
          @delete-session="sessionMutations.deleteSession"
          @archive-session="sessionMutations.archiveSession"
          @select-session="handleTopPanelSessionSelect"
          @open-directory="openProjectPicker"
          @edit-project="handleEditProject"
          @open-settings="isSettingsOpen = true"
          @logout="handleLogout"
          @dropdown-closed="focusInput"
          @toggle-favourite="sessionTagsState.toggleFavourite"
          @update-tags="(sid: string, tags: string[]) => sessionTagsState.setTags(sid, tags)"
          @export-markdown="handleExportMarkdown"
          @export-json="handleExportJson"
        />
      </header>
      <div
        ref="appBodyEl"
        class="app-body"
        :class="{ 'todo-collapsed': sidePanelCollapsed }"
        :style="sidePanelWidth !== null ? ({ '--todo-panel-width': `${sidePanelWidth}px` } as any) : undefined"
      >
        <div ref="sidePanelAreaEl" class="side-panel-area">
          <SidePanel
            class="todo-panel"
            :class="{ 'is-disabled': !hasSession }"
            :collapsed="sidePanelCollapsed"
            :active-tab="sidePanelActiveTab"
            :todo-sessions="todoPanelSessions"
            :tree-nodes="treeNodes"
            :expanded-tree-paths="expandedTreePaths"
            :selected-tree-path="selectedTreePath"
            :tree-loading="treeLoading"
            :tree-error="treeError"
            :tree-status-by-path="gitStatusByPath"
            :tree-branch-info="gitStatus?.branch"
            :tree-diff-stats="gitStatus?.diffStats"
            :tree-directory-name="treeDirectoryName"
            :tree-branch-entries="branchEntries"
            :tree-branch-list-loading="branchListLoading"
            :run-shell-command="shellManager.runTreeShellCommand"
            :worktrees="worktrees"
            :worktrees-loading="worktreesLoading"
            :home-path="homePath"
            @toggle-collapse="toggleSidePanelCollapsed"
            @change-tab="setSidePanelTab"
            @toggle-dir="toggleTreeDirectory"
            @select-file="selectTreeFile"
            @open-diff="fileViewers.openGitDiff"
            @open-diff-all="(payload: { mode: 'staged' | 'changes' | 'all' }) => fileViewers.openAllGitDiff(payload.mode)"
            @open-file="fileViewers.openFileViewer"
            @reload="reloadTree().then(() => refreshGitStatus())"
            @switch-worktree="handleSwitchWorktree"
            @delete-worktree="deleteWorktree"
            @create-worktree-from-branch="handleCreateWorktreeFromBranch"
            @refresh-worktrees="refreshWorktrees"
          />
          <div v-if="!sidePanelCollapsed" class="side-resizer" @pointerdown="appLayout.startSidePanelResize"></div>
        </div>
        <div class="app-main-column">
          <main ref="outputEl" class="app-output">
            <div class="output-workspace">
              <div class="tool-window-layer">
                <div class="output-split">
                  <OutputPanel
                    ref="outputPanelRef"
                    :key="selectedSessionId"
                    class="output-panel"
                    :project-name="currentProjectName"
                    :project-color="currentProjectColor"
                    :is-following="isFollowing"
                    :status-text="statusText"
                    :is-status-error="isStatusError"
                    :is-thinking="isThinking"
                    :is-retry-status="!!retryStatus"
                    :busy-descendant-count="busyDescendantSessionIds.length"
                    :theme="shikiTheme"
                    :resolve-agent-color="resolveAgentColorForName"
                    :resolve-model-meta="resolveModelMetaForPath"
                    :compute-context-percent="messageMeta.computeContextPercent"
                    :session-revert="sessionRevert"
                    @message-rendered="handleOutputPanelMessageRendered"
                    @resume-follow="handleOutputPanelResumeFollow"
                    @fork-message="sessionMutations.handleForkMessage"
                    @revert-message="sessionMutations.handleRevertMessage"
                    @undo-revert="sessionMutations.handleUndoRevert"
                    @show-message-diff="fileViewers.handleShowMessageDiff"
                    @show-commit="fileViewers.handleShowCommit"
                    @show-thread-history="toolWindows.handleShowThreadHistory"
                    @edit-message="handleEditMessage"
                    @open-image="toolWindows.handleOpenImage"
                    @open-file="fileViewers.openFileViewer"
                    @content-resized="handleOutputPanelContentResized"
                    @initial-render-complete="handleOutputPanelInitialRenderComplete"
                  />
                </div>
              </div>
            </div>
          </main>
          <footer
            ref="inputEl"
            class="app-input"
            :class="{ 'is-disabled': !hasSession }"
            :style="inputHeight !== null ? { height: `${inputHeight}px` } : undefined"
          >
            <div class="input-resizer" @pointerdown="appLayout.startInputResize"></div>
            <InputPanel
              ref="inputPanelRef"
              :disabled="connectionState !== 'ready'"
              :can-send="canSend"
              :agent-options="agentOptions"
              :has-agent-options="hasAgentOptions"
              :agent-color="currentAgentColor"
              :resolve-agent-color="resolveAgentColorForName"
              :model-options="modelOptions"
              :thinking-options="thinkingOptions"
              :has-model-options="hasModelOptions"
              :has-thinking-options="hasThinkingOptions"
              :can-attach="canAttach"
              :is-thinking="isThinking"
              :can-abort="canAbort"
              :commands="commandOptions"
              :attachments="attachments"
              :message-input="messageInput"
              :selected-mode="selectedMode"
              :selected-model="selectedModel"
              :selected-thinking="selectedThinking"
              :prompt-queue="selectedSessionQueue"
              @update:message-input="handleMessageInputUpdate"
              @update:selected-mode="handleSelectedModeUpdate"
              @update:selected-model="handleSelectedModelUpdate"
              @update:selected-thinking="handleSelectedThinkingUpdate"
              @apply-history-entry="handleApplyHistoryEntry"
              @send="sendMessage"
              @abort="abortSession"
              @add-attachments="handleAddAttachments"
              @remove-attachment="removeAttachment"
              @open-image="toolWindows.handleOpenImage"
              @cancel-queued-prompt="cancelQueuedPrompt"
            />
          </footer>
        </div>
        <div ref="toolWindowCanvasEl" class="tool-window-canvas">
          <TransitionGroup appear name="scale">
            <FloatingWindow
              v-for="entry in fw.entries.value"
              :key="entry.key"
              :entry="entry"
              :manager="fw"
              @focus="fw.bringToFront(entry.key)"
              @close="handleFloatingWindowClose(entry.key)"
            />
          </TransitionGroup>
        </div>
      </div>
    </template>
    <div v-else class="app-loading-view" role="status" aria-live="polite">
      <div class="app-loading-card">
        <div class="absolute w-0 h-0 -z-10 flex items-center justify-center">
          <div class="flex fixed flex-col items-center w-96 h-40 translate-x-1/2 -translate-y-1/2">
            <div class="mb-4">
              <svg width="24mm" height="12mm" version="1.1" viewBox="0 0 24 12" xmlns="http://www.w3.org/2000/svg">
                <path d="m12.342 2.4512v3.328l1.3352 1.3352v3.9658l-0.67757 0.67756h-1.2953l-0.67757-0.67756v-8.629zm0-1.0562h-1.3153l-0.23914-0.23914v-0.91671l0.23914-0.23914h1.3153l0.23914 0.23914v0.91671zm10.602 9.6852-0.67756 0.67756h-6.6162l-0.67756-0.67756v-1.9928h1.3352v1.3352h2.6305v-2.6505h-3.2882l-0.67756-0.67756v-3.9658l0.67756-0.67757h6.6162l0.67756 0.67757v1.9729h-1.3153v-1.3153h-3.9857v2.6505h4.6234l0.67756 0.67757z" fill="#ffffff" />
                <path d="m1 0 5.4506 6-5.4506 6h3.6337l4.851-5.34v-1.32l-4.851-5.34z" fill="#60a5fa" />
              </svg>
            </div>
            <div class="text-text-100 rounded-xl bg-surface-900 py-2 px-4"><span class="text-accent-400">V</span>is - OpenCode Visualizer</div>
          </div>
        </div>
        <div v-if="uiInitState === 'login'" class="app-login-form">
          <p class="app-loading-title">Connect to OpenCode Server</p>
          <div class="app-login-fields">
            <input v-model="loginUsername" type="text" class="app-login-input" placeholder="Username" name="username" :disabled="!loginRequiresAuth" @keydown.enter="handleLogin" />
            <input v-model="loginPassword" type="password" class="app-login-input" placeholder="Password" :disabled="!loginRequiresAuth" @keydown.enter="handleLogin" />
            <label class="app-login-checkbox"><input v-model="loginRequiresAuth" type="checkbox" /> The server requires authentication</label>
            <input v-model="loginUrl" type="text" class="app-login-input" placeholder="http://localhost:4096" name="url" @keydown.enter="handleLogin" />
          </div>
          <p v-if="initErrorMessage" class="app-loading-message app-error-message">{{ initErrorMessage }}</p>
          <button type="button" class="app-loading-retry bg-indigo-500!" @click="handleLogin">Connect</button>
          <Welcome :theme="shikiTheme" class="mt-8" />
        </div>
        <div v-else>
          <div class="app-loading-spinner" aria-hidden="true"></div>
          <p class="app-loading-title">Loading session data...</p>
          <p class="app-loading-message">{{ uiInitState === 'error' ? initErrorMessage : initLoadingMessage }}</p>
          <div class="app-loading-actions">
            <button v-if="uiInitState === 'error'" type="button" class="app-loading-retry" @click="startInitialization">Retry</button>
            <button v-if="uiInitState === 'loading' && connectionState === 'connecting'" type="button" class="app-loading-retry app-loading-abort" @click="handleAbortInit">Abort</button>
          </div>
        </div>
      </div>
    </div>
    <ProjectPicker :open="isProjectPickerOpen" :home-path="homePath" @close="isProjectPickerOpen = false" @select="handleProjectDirectorySelect" />
<SettingsModal :open="isSettingsOpen" :theme-mode="mode" @close="isSettingsOpen = false" @update:theme-mode="setMode" @open-analytics="isSettingsOpen = false; isAnalyticsOpen = true" @open-mcp="isMcpPanelOpen = true" />
    <ShortcutHelp :open="isShortcutHelpOpen" @close="isShortcutHelpOpen = false" />
    <CommandPalette
      :open="palette.isOpen.value"
      :query="palette.query.value"
      :groups="palette.filteredResults.value"
      @update:query="(v) => (palette.query.value = v)"
      @execute="handlePaletteExecute"
      @close="palette.close()"
    />
    <AnalyticsPanel
      :open="isAnalyticsOpen"
      :session-id="selectedSessionId"
      :project-id="selectedProjectId"
      :context-limit="analyticsContextLimit"
      @close="isAnalyticsOpen = false"
    />
    <McpServerPanel
      :open="isMcpPanelOpen"
      :servers="mcpServers.listServers()"
      @close="isMcpPanelOpen = false"
      @add="mcpServers.addServer"
      @update="mcpServers.updateServer"
      @remove="mcpServers.removeServer"
      @connect="(name: string) => opencodeApi.connectMcpServer(name, activeDirectory || undefined)"
      @disconnect="(name: string) => opencodeApi.disconnectMcpServer(name, activeDirectory || undefined)"
    />
    <ProjectSettingsDialog
      :open="!!editingProject"
      :project-id="editingProject?.projectId ?? ''"
      :worktree="editingProject?.worktree ?? ''"
      :name="editingProjectMeta?.name"
      :icon-color="editingProjectMeta?.icon?.color"
      :icon-override="editingProjectMeta?.icon?.override"
      :commands-start="editingProjectMeta?.commands?.start"
      @close="editingProject = null"
      @save="handleSaveProject"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, reactive, watch, watchEffect, type Ref } from 'vue';
import { bundledThemes } from 'shiki/bundle/web';
import InputPanel from './components/InputPanel.vue';
import OutputPanel from './components/OutputPanel.vue';
import ProjectPicker from './components/ProjectPicker.vue';
import FloatingWindow from './components/FloatingWindow.vue';
import SubagentContent from './components/ToolWindow/Subagent.vue';
import SidePanel from './components/SidePanel.vue';
import Welcome from './components/Welcome.vue';
import TopPanel from './components/TopPanel.vue';
import SettingsModal from './components/SettingsModal.vue';
import CommandPalette from './components/CommandPalette.vue';
import ShortcutHelp from './components/ShortcutHelp.vue';
import McpServerPanel from './components/McpServerPanel.vue';
import ProjectSettingsDialog from './components/ProjectSettingsDialog.vue';
import { useAutoScroller, type ScrollMode } from './composables/useAutoScroller';
import { useFileTree } from './composables/useFileTree';
import { useFloatingWindows } from './composables/useFloatingWindows';
import { usePermissions } from './composables/usePermissions';
import { useMcpPermissions } from './composables/useMcpPermissions';
import { useQuestions } from './composables/useQuestions';
import { useTodos } from './composables/useTodos';
import { useDeltaAccumulator } from './composables/useDeltaAccumulator';
import { useGlobalEvents } from './composables/useGlobalEvents';
import { useMessages } from './composables/useMessages';
import { useMcpServers } from './composables/useMcpServers';
import { useOpenCodeApi } from './composables/useOpenCodeApi';
import { useReasoningWindows } from './composables/useReasoningWindows';
import { useServerState } from './composables/useServerState';
import { useSessionSelection } from './composables/useSessionSelection';
import { useSubagentWindows } from './composables/useSubagentWindows';
import { useSessionTags } from './composables/useSessionTags';
import type { MessageInfo, MessagePart, TextPart } from './types/sse';
import { resolveProjectColorHex } from './utils/stateBuilder';
import * as opencodeApi from './utils/opencode';
import { opencodeTheme, resolveTheme, resolveAgentColor } from './utils/theme';
import { useCredentials } from './composables/useCredentials';
import { useSettings } from './composables/useSettings';
import { StorageKeys, storageGet, storageKey, storageRemove, storageSet } from './utils/storageKeys';
import { toErrorMessage } from './utils/formatters';
import { runDebugCommand } from './utils/debugCommands';
import { useShellManager } from './composables/useShellManager';
import { usePtyOneshot } from './composables/usePtyOneshot';
import { useFileViewers } from './composables/useFileViewers';
import { useToolWindows, decodeApiTextContent } from './composables/useToolWindows';
import { useComposerDrafts } from './composables/useComposerDrafts';
import { useAppLayout } from './composables/useAppLayout';
import { useSessionMutations } from './composables/useSessionMutations';
import { useMessageMeta } from './composables/useMessageMeta';
import { useModelOptions, buildThinkingOptions, buildProviderModelKey, parseProviderModelKey } from './composables/useModelOptions';
import { useGlobalShortcuts } from './composables/useGlobalShortcuts';
import { useCommandPalette } from './composables/useCommandPalette';
import { useProjectSessionNav } from './composables/useProjectSessionNav';
import { useComposerState } from './composables/useComposerState';
import { useChatActions } from './composables/useChatActions';
import { useOutputHandlers } from './composables/useOutputHandlers';
import { useAppInit } from './composables/useAppInit';
import { useSessionStatus } from './composables/useSessionStatus';
import { useTheme } from './composables/useTheme';
import { useLifecycleWatches } from './composables/useLifecycleWatches';
import { useWorktrees } from './composables/useWorktrees';
import { useAnalytics } from './composables/useAnalytics';
import AnalyticsPanel from './components/AnalyticsPanel.vue';

const credentials = useCredentials();
const { suppressAutoWindows } = useSettings();
const { mode, resolvedMode, setMode } = useTheme();
const shikiTheme = computed(() => (resolvedMode.value === 'light' ? 'github-light' : 'github-dark'));
const FOLLOW_THRESHOLD_PX = 24;
const REASONING_CLOSE_DELAY_MS = 3000;
const SUBAGENT_CLOSE_DELAY_MS = 3000;
const ATTACHMENT_MIME_ALLOWLIST = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

const sendStatus = ref('Ready');
const sessionError = ref('');
const connectionState = ref<'connecting' | 'bootstrapping' | 'ready' | 'reconnecting' | 'error'>('connecting');
const uiInitState = ref<'loading' | 'ready' | 'error' | 'login'>('loading');

const appEl = ref<HTMLElement | null>(null);
const appBodyEl = ref<HTMLElement | null>(null);
const sidePanelAreaEl = ref<HTMLElement | null>(null);
const outputEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLElement | null>(null);
const toolWindowCanvasEl = ref<HTMLDivElement | null>(null);
const topPanelRef = ref<{ closeSessionDropdown: () => void; toggleSessionDropdown: () => void } | null>(null);
const inputPanelRef = ref<{ focus: () => void; reset: () => void } | null>(null);
const outputPanelRef = ref<{ panelEl: HTMLDivElement | null } | null>(null);

const fw = useFloatingWindows();
const sessionTagsState = useSessionTags();
const { sessionTags, sessionFavourites } = sessionTagsState;
const sessionContentCache = reactive<Record<string, string>>({});
const serverState = useServerState();
const openCodeApi = useOpenCodeApi(serverState.projects);
const bootstrapReady = serverState.bootstrapped;
const sessionSelection = useSessionSelection(
  computed(() => serverState.projects),
  async (projectId) => {
    const directory = serverState.projects[projectId]?.worktree?.trim();
    if (!directory) throw new Error('Session create failed: project worktree is empty.');
    const created = await openCodeApi.createSession(directory);
    if (!created?.id) throw new Error('Session create failed: invalid response.');
    return { id: created.id, projectId };
  },
);
const { selectedProjectId, selectedSessionId, projectDirectory, activeDirectory, switchSession: switchSessionSelection, initialize: initializeSessionSelection } = sessionSelection;

const mo = useModelOptions();
const { providers, agents, commands, modelOptions, agentOptions, thinkingOptions, providersLoaded, providersLoading, providersFetchCount, agentsLoading, commandsLoading, selectedModel, selectedThinking, selectedMode, applyModelVariantSelection, applyAgentDefaults, resolveDefaultAgentModel, fetchProviders, fetchAgents, fetchCommands } = mo;

const toolWindows = useToolWindows(fw, { activeDirectory, shikiTheme: shikiTheme as any });
const composerDrafts = useComposerDrafts();
const appLayout = useAppLayout({ outputEl, inputEl, appBodyEl, sidePanelAreaEl, toolWindowCanvasEl, fw, shellManager: undefined as any });

const outputPanelContainerEl = computed(() => outputPanelRef.value?.panelEl ?? undefined);
const outputPanelScrollMode = computed<ScrollMode>(() => 'follow');
const { isFollowing, enableFollow, resetFollow, resumeFollow, scrollToBottom: scrollOutputPanelToBottom, notifyContentChange } = useAutoScroller(outputPanelContainerEl, outputPanelScrollMode, { bottomThresholdPx: FOLLOW_THRESHOLD_PX, observeDelayMs: 0, smoothEngine: 'native', smoothOnInitialFollow: false });

const primaryHistoryRequestId = ref(0);
const userMessageMetaById = ref<Record<string, { total: number }>>({});
const userMessageTimeById = ref<Record<string, number>>({});
const notificationPermissionRequested = ref(false);
const isAnalyticsOpen = ref(false);

function resolveProjectIdForSession(sessionId: string): string {
  const preferredProjectId = selectedProjectId.value.trim();
  if (preferredProjectId) {
    const preferredSessions = sessionsByProject.value[preferredProjectId] ?? [];
    if (preferredSessions.some((s: any) => s.id === sessionId)) return preferredProjectId;
  }
  for (const [projectId, projectSessions] of Object.entries(sessionsByProject.value)) {
    if (projectSessions.some((s: any) => s.id === sessionId)) return projectId;
  }
  return '';
}

const ge = useGlobalEvents(credentials);
const msg = useMessages();

const messageMeta = useMessageMeta({
  notificationPermissionRequested, sessions: () => sessions.value,
  resolveProjectIdForSession,
  sessionLabel: (s: any) => s.title || s.slug || s.id, switchSessionSelection,
  selectedProjectId, selectedSessionId, providers, userMessageMetaById,
  userMessageTimeById, msg, primaryHistoryRequestId,
  getSelectedWorktreeDirectory: () => activeDirectory.value.trim(), notifyContentChange,
  ge: ge as any,
});

const analytics = useAnalytics();
ge.on('message.updated', (payload) => {
  if (payload.info.role !== 'assistant') return;
  analytics.recordUsage(payload.info.sessionID, resolveProjectIdForSession(payload.info.sessionID), payload.info);
});
ge.setWorkerMessageHandler(serverState.handleStateMessage);
serverState.setNotificationShowHandler((message) => { messageMeta.showBrowserNotification(message.projectId, message.sessionId, message.kind); });
const deltaAccumulator = useDeltaAccumulator();
deltaAccumulator.listen(ge);
const sessionScope = ge.session(selectedSessionId, computed(() => { const r: Record<string, string | undefined> = {}; sessionParentById.value.forEach((parentId, sessionId) => { r[sessionId] = parentId; }); return r; }));
const mainSessionScope = ge.mainSession(selectedSessionId);
msg.bindScope(mainSessionScope);

watch(
  [() => selectedSessionId.value, () => msg.messages.value],
  () => {
    const sessionId = selectedSessionId.value;
    if (!sessionId) return;
    const chunks: string[] = [];
    for (const entryRef of msg.messages.value.values()) {
      const entry = entryRef.value;
      if (!entry.info) continue;
      const summary = (entry.info as Record<string, unknown>).summary as
        | Record<string, unknown>
        | undefined;
      if (typeof summary?.title === 'string') chunks.push(summary.title);
      if (typeof summary?.body === 'string') chunks.push(summary.body);
      for (const partRef of entry.parts) {
        const part = partRef.value;
        if (part.type === 'text' && typeof part.text === 'string') {
          chunks.push(part.text);
        }
      }
    }
    sessionContentCache[sessionId] = chunks.join('\n');
  },
  { immediate: true },
);

const reasoning = useReasoningWindows({ selectedSessionId, fw, reasoningComponent: SubagentContent, theme: () => shikiTheme.value, reasoningCloseDelayMs: REASONING_CLOSE_DELAY_MS, resolveModelName: (providerID: string, modelID: string) => { const key = `${providerID}/${modelID}`; return modelOptions.value.find((m) => m.id === key)?.displayName; }, suppressAutoWindows });
const { updateReasoningExpiry } = reasoning;
reasoning.bindScope(sessionScope);

const subagentWindows = useSubagentWindows({ selectedSessionId, fw, subagentComponent: SubagentContent, theme: () => shikiTheme.value, closeDelayMs: SUBAGENT_CLOSE_DELAY_MS, resolveModelName: (providerID: string, modelID: string) => { const key = `${providerID}/${modelID}`; return modelOptions.value.find((m) => m.id === key)?.displayName; }, suppressAutoWindows });
subagentWindows.bindScope(sessionScope);

(messageMeta as any).msg = msg;
(messageMeta as any).ge = ge;

const { treeNodes, expandedTreePaths, expandedTreePathSet, selectedTreePath, treeLoading, treeError, gitStatus, gitStatusByPath, refreshGitStatus, reloadTree, toggleTreeDirectory, selectTreeFile, feed, branchEntries, branchListLoading, refreshBranchEntries } = useFileTree({ activeDirectory });

const shellManager = useShellManager(fw, { getDirectory: () => activeDirectory.value, getCanvasEl: () => toolWindowCanvasEl.value, onTreeCommandSuccess: () => { void refreshGitStatus(); void refreshBranchEntries(); }, log: (message: unknown, error?: unknown) => { if (error !== undefined) console.log(message, error); else console.log(message); } });
appLayout.shellManager = shellManager as any;

const fileViewers = useFileViewers(fw, { getDirectory: () => activeDirectory.value, getShikiTheme: () => shikiTheme.value, resolvePath: (path?: string) => { if (!path) return undefined; const np = path.replace(/\/+$/, ''); const base = activeDirectory.value.replace(/\/+$/, ''); if (!base) return np; if (!np.startsWith('/')) return np; if (np === base) return '.'; const prefix = `${base}/`; if (np.startsWith(prefix)) return np.slice(prefix.length); return np; } });

const currentProject = computed(() => serverState.projects[selectedProjectId.value]);
const { worktrees, loading: worktreesLoading, refreshWorktrees } = useWorktrees({ activeDirectory, currentProject, activeGitBranchInfo: computed(() => gitStatus.value?.branch ?? null) });

const allowedSessionIds = computed(() => {
  const rootId = selectedSessionId.value; if (!rootId) return new Set<string>();
  const childrenByParent = new Map<string, string[]>();
  sessionParentById.value.forEach((parentId, sessionId) => { if (!parentId) return; const bucket = childrenByParent.get(parentId) ?? []; bucket.push(sessionId); childrenByParent.set(parentId, bucket); });
  const allowed = new Set<string>(); const stack = [rootId];
  while (stack.length > 0) { const current = stack.pop()!; if (allowed.has(current)) continue; allowed.add(current); const children = childrenByParent.get(current); if (children) stack.push(...children); }
  return allowed;
});

const { todosBySessionId, todoLoadingBySessionId, todoErrorBySessionId, normalizeTodoItems, reloadTodosForAllowedSessions } = useTodos({ selectedSessionId, allowedSessionIds, activeDirectory });

watchEffect(() => {});

const { upsertPermissionEntry, removePermissionEntry, prunePermissionEntries, fetchPendingPermissions } = usePermissions({ fw, allowedSessionIds, activeDirectory, ensureConnectionReady: () => true });
const { upsertQuestionEntry, removeQuestionEntry, pruneQuestionEntries, fetchPendingQuestions } = useQuestions({ fw, allowedSessionIds, activeDirectory, ensureConnectionReady: () => true, getTextContent: (messageId: string) => msg.getTextContent(messageId) || '' });
const { upsertMcpPermissionEntry, removeMcpPermissionEntry, pruneMcpPermissionEntries } = useMcpPermissions({ fw, allowedSessionIds, activeDirectory, ensureConnectionReady: () => true });

const homePath = ref(''); const serverWorktreePath = ref(''); const sidePanelCollapsed = ref(false);
const isShortcutHelpOpen = ref(false);
const sidePanelActiveTab = ref<'todo' | 'tree' | 'worktrees'>('tree');
const { inputHeight, sidePanelWidth } = appLayout;

function toSessionInfo(directory: string, session: any): any {
  return { id: session.id, parentID: session.parentID, title: session.title, slug: session.slug, directory, status: session.status, time: { created: session.timeCreated, updated: session.timeUpdated, archived: session.timeArchived }, revert: session.revert };
}
function collectAllSessionsByProject() { const byProject: Record<string, any[]> = {}; Object.values(serverState.projects).forEach((project: any) => { const list: any[] = []; Object.values(project.sandboxes).forEach((sandbox: any) => { Object.values(sandbox.sessions).forEach((session: any) => { list.push(toSessionInfo(sandbox.directory, session)); }); }); byProject[project.id] = list; }); return byProject; }
const sessionsByProject = computed(() => collectAllSessionsByProject());
const sessions = computed(() => { const projectId = selectedProjectId.value.trim(); if (!projectId) return []; const directory = activeDirectory.value.trim(); const all = sessionsByProject.value[projectId] ?? []; const roots = all.filter((session: any) => !session.parentID); const filtered = directory ? roots.filter((session: any) => !session.directory || session.directory === directory) : roots; return filtered.slice().sort((a: any, b: any) => (b.time?.created ?? 0) - (a.time?.created ?? 0)); });
const sessionParentById = computed(() => { const map = new Map<string, string | undefined>(); const projectId = selectedProjectId.value.trim(); if (!projectId) return map; const all = sessionsByProject.value[projectId] ?? []; all.forEach((session: any) => map.set(session.id, session.parentID)); return map; });
const runningToolIds = reactive(new Set<string>());
function getSessionStatus(sessionId: string, projectId?: string) { const pid = (projectId || selectedProjectId.value).trim(); const all = pid ? (sessionsByProject.value[pid] ?? []) : []; const found = all.find((session: any) => session.id === sessionId); const status = found?.status; return status === 'busy' || status === 'idle' || status === 'retry' ? status : undefined; }
const busyDescendantSessionIds = computed(() => { const allowed = allowedSessionIds.value; const selected = selectedSessionId.value; const ids: string[] = []; for (const sid of allowed) { if (sid === selected) continue; const status = getSessionStatus(sid); if (status === 'busy' || status === 'retry') ids.push(sid); } return ids; });
const isThinking = computed(() => { const selected = selectedSessionId.value; const ownStatus = selected ? getSessionStatus(selected) : undefined; return Boolean(ownStatus === 'busy' || ownStatus === 'retry' || busyDescendantSessionIds.value.length > 0 || runningToolIds.size > 0); });
const filteredSessions = computed(() => sessions.value); const hasSession = computed(() => sessions.value.length > 0);
const notificationSessionOrder = ref<string[]>([]);

const outputHandlers = useOutputHandlers({ shellManager, fw, toolWindowCanvasEl, inputEl, appEl, inputPanelRef, outputPanelRef, sidePanelCollapsed, sidePanelActiveTab, sidePanelWidth, shikiTheme, sendStatus, serverState, sessions, selectedSessionId, activeDirectory, projectDirectory, notificationSessionOrder, sessionParentById, allowedSessionIds, busyDescendantSessionIds, runDebugCommand, autoScroller: { enableFollow, resetFollow, resumeFollow, scrollToBottom: scrollOutputPanelToBottom }, notifyContentChange, ge, sessionScope, mainSessionScope, connectionState, uiInitState, homePath });
const { handleWindowResize, syncFloatingExtent, updateFloatingExtentObserver, runAppDebugCommand, handleOutputPanelMessageRendered, handleOutputPanelResumeFollow, handleOutputPanelContentResized, handleOutputPanelInitialRenderComplete, handleFloatingWindowClose, getBundledThemeNames, pickShikiTheme, normalizeDirectory, replaceHomePrefix, resolveWorktreeRelativePath, sessionLabel, getSelectedWorktreeDirectory, requireSelectedWorktree, ensureConnectionReady, readSidePanelCollapsed, persistSidePanelCollapsed, readSidePanelTab, persistSidePanelTab, toggleSidePanelCollapsed, setSidePanelTab, focusInput } = outputHandlers;
sidePanelCollapsed.value = readSidePanelCollapsed(); sidePanelActiveTab.value = readSidePanelTab();

const mcpServers = useMcpServers();
const isMcpPanelOpen = ref(false);
const sessionStatus = useSessionStatus({ selectedSessionId, allowedSessionIds, updateReasoningExpiry });
const { retryStatus, formatRetryTime, applySessionStatusEvent } = sessionStatus;

const projectNav = useProjectSessionNav({ serverState, openCodeApi, sessionSelection, homePath, sendStatus, ensureConnectionReady, fetchCommands, bootstrapReady, sessionsByProject, fw, ge, msg, reasoning, subagentWindows, shellManager, retryStatus, todosBySessionId, todoLoadingBySessionId, todoErrorBySessionId, focusInput, fetchPendingPermissions, fetchPendingQuestions, allowedSessionIds, sessions, sessionParentById, sessionLabel, isBootstrapping: ref(false), uiInitState, messageMeta, resetFollow, scrollOutputPanelToBottom, reloadTodosForAllowedSessions, sessionError, notificationSessionOrder });
const { editingProject, isProjectPickerOpen, isSettingsOpen, projectError, worktreeError, navigableTree, topPanelTreeData, currentProjectColor, currentProjectName, editingProjectMeta, notificationSessions, todoPanelSessions, createNewSession, createWorktreeFromWorktree, deleteWorktree, handleProjectDirectorySelect, handleNewSessionInSandbox, openProjectPicker, handleEditProject, handleSaveProject, bootstrapSelections, handleTopPanelSessionSelect, handleNotificationSessionSelect, reloadSelectedSessionState, validateSelectedSession, pickPreferredSessionId, sessionSortKey, readQuerySelection, replaceQuerySelection, createSessionInDirectory, initProjectNameFromPackageJson, resolveProjectIdForDirectory } = projectNav;

function handleNotificationClick() {
  messageMeta.ensureBrowserNotificationPermission();
  const total = notificationSessions.value.reduce((sum, item) => sum + item.count, 0);
  if (total > 0 && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const notification = new Notification('OpenCode Visualizer', {
      body: `${total} pending notification${total > 1 ? 's' : ''}`,
      tag: 'vis-notification-summary',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
  handleNotificationSessionSelect();
}

const composerState = useComposerState({ selectedSessionId, selectedModel, selectedThinking, selectedMode, modelOptions, agentOptions, thinkingOptions, agents, applyAgentDefaults, applyModelVariantSelection, resolveDefaultAgentModel, composerDrafts, msg, sendStatus, attachmentMimeAllowlist: ATTACHMENT_MIME_ALLOWLIST, opencodeTheme, resolveTheme, resolveAgentColor, storageKey, StorageKeys, userMessageMetaById });
const { messageInput, attachments, handleMessageInputUpdate, persistComposerDraftForCurrentContext, clearComposerDraftForCurrentContext, restoreComposerDraftForContext, handleComposerDraftStorage, buildComposerDraftFromUserMessage, handleSelectedModeUpdate, handleSelectedModelUpdate, handleSelectedThinkingUpdate, handleApplyHistoryEntry, handleAddAttachments, removeAttachment, generateAttachmentId, readFileAsDataUrl, hasAgentOptions, hasModelOptions, hasThinkingOptions, canAttach, visibleAgents, resolveAgentColorForName, resolveModelMetaForPath, currentAgentColor } = composerState;

const sessionMutations = useSessionMutations({ selectedProjectId, selectedSessionId, activeDirectory, sessionError, sendStatus, ensureConnectionReady, openCodeApi, switchSessionSelection, reloadSelectedSessionState, seedForkedSessionComposerDraft: buildComposerDraftFromUserMessage });

const chatActions = useChatActions({ ensureConnectionReady, activeDirectory, selectedSessionId, filteredSessions, messageInput, attachments, selectedMode, selectedModel, selectedThinking, modelOptions, parseProviderModelKey, opencodeApi: opencodeApi as any, shellManager: { openShellFromInput: (input: string) => shellManager.openShellFromInput(input) }, runAppDebugCommand, commands, requireSelectedWorktree, enableFollow, clearComposerDraftForCurrentContext, busyDescendantSessionIds, isThinking, uiInitState, connectionState, sendStatus, pickPreferredSessionId });
const { sendMessage, sendCommand, abortSession, parseSlashCommand, findCommandByName, isSending, isAborting, commandOptions, canSend, canAbort, promptQueue, cancelQueuedPrompt, tryDrainQueue } = chatActions;

const selectedSessionStatus = computed(() => {
  const session = filteredSessions.value.find((s) => s.id === selectedSessionId.value);
  return session?.status;
});
const selectedSessionQueue = computed(() => promptQueue.value.filter((i) => i.sessionId === selectedSessionId.value));
watch(selectedSessionStatus, (status, prevStatus) => {
  if ((prevStatus === 'busy' || prevStatus === 'retry') && status === 'idle' && selectedSessionId.value) {
    void tryDrainQueue(selectedSessionId.value);
  }
});
watch(() => connectionState.value, (state, prevState) => {
  if (state === 'ready' && prevState !== 'ready') {
    void tryDrainQueue();
  }
});

const paletteSessions = computed(() => {
  const list: Array<{ id: string; projectId: string; title?: string; slug?: string; directory?: string }> = [];
  for (const [projectId, projectSessions] of Object.entries(sessionsByProject.value)) {
    for (const session of projectSessions) {
      list.push({
        id: session.id,
        projectId,
        title: session.title,
        slug: session.slug,
        directory: session.directory,
      });
    }
  }
  return list;
});

const paletteProjects = computed(() => {
  return Object.values(serverState.projects).map((project) => ({
    id: project.id,
    name: project.name?.trim() || project.worktree.replace(/\/+$/, '').split('/').pop() || project.id,
    worktree: project.worktree,
  }));
});

const paletteCommands = computed(() =>
  commandOptions.value.map((command) => ({
    name: command.name,
    description: command.description,
    hints: command.hints,
  })),
);

const palette = useCommandPalette({
  sessions: paletteSessions,
  projects: paletteProjects,
  commands: paletteCommands,
});

async function handlePaletteExecute(result: Parameters<typeof palette['flatResults']['value'][number]>[0] extends { type: infer T } ? { type: T; item?: unknown } : never) {
  palette.close();
  if (result.type === 'session') {
    const item = (result as { type: 'session'; item: { id: string; projectId: string } }).item;
    await switchSessionSelection(item.projectId, item.id);
    return;
  }
  if (result.type === 'project') {
    const item = (result as { type: 'project'; item: { id: string } }).item;
    const projectSessions = sessionsByProject.value[item.id] ?? [];
    const targetId = pickPreferredSessionId(projectSessions);
    if (targetId) {
      await switchSessionSelection(item.id, targetId);
    }
    return;
  }
  if (result.type === 'command') {
    const item = (result as { type: 'command'; item: { name: string } }).item;
    messageInput.value = `/${item.name} `;
    nextTick(() => focusInput());
    return;
  }
  if (result.type === 'settings') {
    isSettingsOpen.value = true;
  }
}

const analyticsContextLimit = computed(() => {
  const { providerID, modelID } = parseProviderModelKey(selectedModel.value);
  const limit = messageMeta.resolveProviderModelLimit(providerID, modelID);
  return limit?.context ?? null;
});

watch(resolvedMode, async (mode) => {
  if (mode === 'light') {
    await import('./App.vue.light.css');
  }
}, { immediate: true });

const globalShortcuts = useGlobalShortcuts({ selectedProjectId, selectedSessionId, navigableTree, switchSessionSelection, createNewSession, openShell: (input: string) => shellManager.openShellFromInput(input), notificationSessions, handleNotificationSessionSelect, focusInput, abortSession, canAbort, sidePanelCollapsed, toggleSidePanelCollapsed, startInputResize: appLayout.startInputResize, startSidePanelResize: appLayout.startSidePanelResize, isSettingsOpen, isAnalyticsOpen, isProjectPickerOpen, isShortcutHelpOpen, isCommandPaletteOpen: palette.isOpen, toggleCommandPalette: palette.toggle, topPanelRef });
const { handleGlobalKeydown } = globalShortcuts;

const appInit = useAppInit({ credentials, ge, bootstrapReady, selectedSessionId, activeDirectory, fetchProviders, fetchAgents, fetchCommands, fetchPendingPermissions, fetchPendingQuestions, bootstrapSelections, reloadSelectedSessionState, refreshGitStatus, shellManager, messageMeta, sendStatus, opencodeApi: opencodeApi as any, serverWorktreePath, homePath, uiInitState, connectionState });
const { initLoadingMessage, initErrorMessage, reconnectingMessage, loginUrl, loginUsername, loginPassword, loginRequiresAuth, startInitialization, handleLogin, handleAbortInit, handleLogout } = appInit;

const statusText = computed(() => { if (connectionState.value === 'reconnecting') return reconnectingMessage.value || 'Reconnecting...'; if (retryStatus.value) return `${retryStatus.value.message} | Next: ${formatRetryTime(retryStatus.value.next)}`; if (openCodeApi.pending.value) return 'Synchronizing with SSE updates...'; return projectError.value || worktreeError.value || sessionError.value || sendStatus.value; });
const isStatusError = computed(() => Boolean(projectError.value || worktreeError.value || sessionError.value || retryStatus.value));
const sessionRevert = computed(() => { const projectId = selectedProjectId.value.trim(); const sessionId = selectedSessionId.value.trim(); if (!projectId || !sessionId) return null; const all = sessionsByProject.value[projectId] ?? []; const session = all.find((s: any) => s.id === sessionId); return session?.revert ?? null; });
const treeDirectoryName = computed(() => { const raw = activeDirectory.value.trim(); if (!raw) return ''; const trimmed = raw.replace(/\/+$/, ''); if (!trimmed) return '/'; const segments = trimmed.split('/').filter(Boolean); return segments.at(-1) ?? '/'; });

function handleSwitchWorktree(directory: string) {
  if (normalizeDirectory(activeDirectory.value) === normalizeDirectory(directory)) return;
  const projectId = selectedProjectId.value.trim();
  const project = serverState.projects[projectId];
  if (!project) return;
  const sandbox = project.sandboxes[directory];
  if (!sandbox) return;
  const rootCandidates = sandbox.rootSessions
    .map((id) => sandbox.sessions[id])
    .filter((s): s is NonNullable<typeof s> => Boolean(s) && !s.timeArchived);
  const candidates = (rootCandidates.length > 0 ? rootCandidates : Object.values(sandbox.sessions).filter((s): s is NonNullable<typeof s> => Boolean(s) && !s.timeArchived))
    .sort((a, b) => (b.timeUpdated ?? b.timeCreated ?? 0) - (a.timeUpdated ?? a.timeCreated ?? 0));
  if (candidates.length > 0) {
    void switchSessionSelection(projectId, candidates[0].id);
  } else {
    void createSessionInDirectory(directory);
  }
}

async function handleCreateWorktreeFromBranch(branch: string) {
  if (!ensureConnectionReady('Creating worktree')) return;
  const baseDirectory = projectDirectory.value;
  if (!baseDirectory) return;
  try {
    await createWorktreeFromWorktree(baseDirectory);
    const projectId = selectedProjectId.value.trim();
    const project = serverState.projects[projectId];
    if (!project) return;
    const newSandbox = Object.values(project.sandboxes)
      .filter((s) => !normalizeDirectory(s.directory).startsWith(normalizeDirectory(baseDirectory) + '/') && normalizeDirectory(s.directory) !== normalizeDirectory(baseDirectory))
      .sort((a, b) => (b.rootSessions.length ? 1 : 0) - (a.rootSessions.length ? 1 : 0))[0];
    if (newSandbox) {
      const { runOneShotPtyCommand } = usePtyOneshot();
      const script = [
        `cd "${newSandbox.directory}"`,
        `git checkout "${branch.replace(/"/g, '\\"')}"`,
      ].join('\n');
      await runOneShotPtyCommand('bash', ['--noprofile', '--norc', '-c', script]);
      void refreshWorktrees();
    }
  } catch {
    void 0;
  }
}

async function handleEditMessage(payload: { sessionId: string; part: MessagePart }) {
  const directory = activeDirectory.value.trim(); if (payload.part.type !== 'text') return;
  const nextText = window.prompt('Edit message', payload.part.text); if (nextText === null) return;
  const trimmed = nextText.trimEnd(); if (!trimmed) return; if (trimmed === payload.part.text) return;
  try { const part = { ...payload.part, text: trimmed }; await opencodeApi.patchMessagePart({ sessionID: payload.sessionId, messageID: part.messageID, partID: part.id, part, directory: directory || undefined }); } catch (error) { console.error('Failed to update message part', error); }
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchSessionMessageEntries(sessionId: string): Promise<Array<{ info: MessageInfo; parts: MessagePart[] }>> {
  if (sessionId === selectedSessionId.value) {
    const result: Array<{ info: MessageInfo; parts: MessagePart[] }> = [];
    for (const entryRef of msg.messages.value.values()) {
      const entry = entryRef.value;
      if (!entry.info) continue;
      const parts: MessagePart[] = [];
      for (const partRef of entry.parts) {
        parts.push(partRef.value);
      }
      result.push({ info: entry.info, parts });
    }
    result.sort((a, b) => (a.info.time.created ?? 0) - (b.info.time.created ?? 0));
    return result;
  }
  const directory = activeDirectory.value.trim();
  const data = (await opencodeApi.listSessionMessages(sessionId, {
    directory: directory || undefined,
  })) as Array<{ info?: unknown; parts?: unknown[] }>;
  const result: Array<{ info: MessageInfo; parts: MessagePart[] }> = [];
  for (const entry of data) {
    const info = entry.info as MessageInfo | undefined;
    if (!info) continue;
    const parts = Array.isArray(entry.parts) ? (entry.parts as MessagePart[]) : [];
    result.push({ info, parts });
  }
  result.sort((a, b) => (a.info.time.created ?? 0) - (b.info.time.created ?? 0));
  return result;
}

async function handleExportMarkdown(sessionId: string) {
  const entries = await fetchSessionMessageEntries(sessionId);
  const lines: string[] = [`# Session ${sessionId} Transcript\n`];
  for (const { info, parts } of entries) {
    const role = info.role === 'user' ? 'User' : 'Assistant';
    lines.push(`## ${role}\n`);
    const texts = parts
      .filter((p): p is TextPart => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text);
    lines.push(texts.join('\n') || '*(no text content)*', '');
  }
  triggerDownload(`session-${sessionId}.md`, lines.join('\n'), 'text/markdown');
}

async function handleExportJson(sessionId: string) {
  const entries = await fetchSessionMessageEntries(sessionId);
  triggerDownload(`session-${sessionId}.json`, JSON.stringify(entries, null, 2), 'application/json');
}

useLifecycleWatches({
  credentials, toolWindowCanvasEl, fw, updateFloatingExtentObserver, projectDirectory, activeDirectory, selectedSessionId,
  isBootstrapping: ref(false), bootstrapReady, pickPreferredSessionId, filteredSessions, validateSelectedSession,
  uiInitState, syncFloatingExtent, inputPanelRef, shellManager,
  reloadSelectedSessionState, selectedProjectId, messageMeta, isThinking, updateReasoningExpiry,
  selectedModel, modelOptions, thinkingOptions, selectedThinking, fetchCommands, reloadTodosForAllowedSessions, sidePanelCollapsed,
  persistSidePanelCollapsed, sidePanelActiveTab, persistSidePanelTab, allowedSessionIds, fetchProviders, ge, sessionScope, mainSessionScope,
  connectionState, reconnectingMessage, sendStatus, credentialsClear: () => credentials.clear(), initErrorMessage, loginUrl, loginUsername,
  loginPassword, loginRequiresAuth, startInitialization, getBundledThemeNames, pickShikiTheme, shikiTheme, handleWindowResize,
  handleComposerDraftStorage, messageMetaHandleWindowAttentionChange: messageMeta.handleWindowAttentionChange, handleGlobalKeydown,
  bootstrapSelections, suppressAutoWindows, toolWindows, msg, reasoning, subagentWindows, retryStatus, todosBySessionId, todoErrorBySessionId,
  normalizeTodoItems, notificationSessionOrder, upsertPermissionEntry, removePermissionEntry, upsertQuestionEntry,
  removeQuestionEntry, upsertMcpPermissionEntry, removeMcpPermissionEntry, applySessionStatusEvent, treeNodes, expandedTreePathSet, selectedTreePath,
});
</script>

<style src="./App.vue.css" scoped></style>
