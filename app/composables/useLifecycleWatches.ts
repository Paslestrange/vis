import { nextTick, watch, watchEffect, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { buildThinkingOptions } from './useModelOptions';
import {
  StorageKeys,
  storageGet,
  storageRemove,
  storageSet,
} from '../utils/storageKeys';

export function useLifecycleWatches(options: {
  credentials: {
    baseUrl: Ref<string>;
    authHeader: Ref<string>;
    url: Ref<string>;
    username: Ref<string>;
    password: Ref<string>;
    isConfigured: Ref<boolean>;
    load: () => void;
  };
  toolWindowCanvasEl: Ref<HTMLDivElement | null>;
  updateFloatingExtentObserver: () => void;
  projectDirectory: Ref<string>;
  activeDirectory: Ref<string>;
  selectedSessionId: Ref<string>;
  isBootstrapping: Ref<boolean>;
  bootstrapReady: Ref<boolean>;
  pickPreferredSessionId: (list: any[]) => string;
  filteredSessions: ComputedRef<any[]>;
  validateSelectedSession: () => void;
  uiInitState: Ref<'loading' | 'ready' | 'error' | 'login'>;
  syncFloatingExtent: () => void;
  inputPanelRef: Ref<{ focus: () => void } | null>;
  shellManager: { restoreShellSessions: () => Promise<void> | void };
  reloadSelectedSessionState: () => Promise<void>;
  selectedProjectId: Ref<string>;
  messageMeta: { syncActiveSelectionToWorker: () => void };
  opencodeApi: { setBaseUrl: (url: string) => void; setAuthorization: (auth: string) => void };
  isThinking: ComputedRef<boolean>;
  updateReasoningExpiry: (sessionId: string, state: 'busy' | 'idle') => void;
  selectedModel: Ref<string>;
  modelOptions: Ref<Array<{ id: string; variants?: Record<string, unknown> }>>;
  thinkingOptions: Ref<Array<string | undefined>>;
  selectedThinking: Ref<string | undefined>;
  fetchCommands: (directory?: string) => Promise<void> | void;
  reloadTodosForAllowedSessions: () => Promise<void> | void;
  sidePanelCollapsed: Ref<boolean>;
  persistSidePanelCollapsed: (value: boolean) => void;
  sidePanelActiveTab: Ref<'todo' | 'tree' | 'worktrees'>;
  persistSidePanelTab: (value: 'todo' | 'tree' | 'worktrees') => void;
  allowedSessionIds: ComputedRef<Set<string>>;
  fetchProviders: (force?: boolean) => Promise<void>;
  ge: {
    on: (event: string, handler: (payload?: any) => void) => (() => void);
    disconnect: () => void;
    sendToWorker: (message: Record<string, unknown>) => void;
  };
  sessionScope: { on: (event: string, handler: (payload?: any) => void) => (() => void); dispose: () => void };
  mainSessionScope: { dispose: () => void };
  connectionState: Ref<'connecting' | 'bootstrapping' | 'ready' | 'reconnecting' | 'error'>;
  reconnectingMessage: Ref<string>;
  sendStatus: Ref<string>;
  credentialsClear: () => void;
  initErrorMessage: Ref<string>;
  loginUrl: Ref<string>;
  loginUsername: Ref<string>;
  loginPassword: Ref<string>;
  loginRequiresAuth: Ref<boolean>;
  startInitialization: () => void;
  getBundledThemeNames: () => string[];
  pickShikiTheme: (names: string[]) => string;
  shikiTheme: Ref<string>;
  appLayout: { handlePointerMove: (e: PointerEvent) => void; handlePointerUp: (e: PointerEvent) => void };
  handleWindowResize: () => void;
  handleComposerDraftStorage: (e: StorageEvent) => void;
  messageMetaHandleWindowAttentionChange: () => void;
  handleGlobalKeydown: (e: KeyboardEvent) => void;
  bootstrapSelections: () => Promise<void>;
  suppressAutoWindows: Ref<boolean>;
  toolWindows: { openToolPartAsWindow: (part: any) => void };
  msg: { reset: () => void };
  reasoning: { reset: () => void };
  subagentWindows: { reset: () => void };
  retryStatus: Ref<{ message: string; next: number; attempt: number } | null>;
  todosBySessionId: Ref<Record<string, any[]>>;
  todoErrorBySessionId: Ref<Record<string, string>>;
  normalizeTodoItems: (items: any[]) => any[];
  notificationSessionOrder: Ref<string[]>;
  validateSelectedSession: () => void;
  upsertPermissionEntry: (request: any) => void;
  removePermissionEntry: (requestID: string) => void;
  upsertQuestionEntry: (request: any) => void;
  removeQuestionEntry: (requestID: string) => void;
  upsertMcpPermissionEntry: (request: any) => void;
  removeMcpPermissionEntry: (requestID: string) => void;
  applySessionStatusEvent: (sessionId: string, status: any) => void;
  shellManager: {
    handlePtyEvent: (event: any) => void;
    lingerAndRemoveShellWindow: (id: string) => void;
    restoreShellSessions: () => Promise<void> | void;
    disposeShellWindows: () => void;
  };
  treeNodes: Ref<any[]>;
  expandedTreePathSet: Ref<Set<string>>;
  selectedTreePath: Ref<string>;
}) {
  const {
    credentials,
    toolWindowCanvasEl,
    updateFloatingExtentObserver,
    projectDirectory,
    activeDirectory,
    selectedSessionId,
    isBootstrapping,
    bootstrapReady,
    pickPreferredSessionId,
    filteredSessions,
    validateSelectedSession,
    uiInitState,
    syncFloatingExtent,
    inputPanelRef,
    shellManager: shellManagerRestore,
    reloadSelectedSessionState,
    selectedProjectId,
    messageMeta,
    opencodeApi,
    isThinking,
    updateReasoningExpiry,
    selectedModel,
    modelOptions,
    thinkingOptions,
    selectedThinking,
    fetchCommands,
    reloadTodosForAllowedSessions,
    sidePanelCollapsed,
    persistSidePanelCollapsed,
    sidePanelActiveTab,
    persistSidePanelTab,
    allowedSessionIds,
    fetchProviders,
    ge,
    sessionScope,
    mainSessionScope,
    connectionState,
    reconnectingMessage,
    sendStatus,
    credentialsClear,
    initErrorMessage,
    loginUrl,
    loginUsername,
    loginPassword,
    loginRequiresAuth,
    startInitialization,
    getBundledThemeNames,
    pickShikiTheme,
    shikiTheme,
    appLayout,
    handleWindowResize,
    handleComposerDraftStorage,
    messageMetaHandleWindowAttentionChange,
    handleGlobalKeydown,
    suppressAutoWindows,
    toolWindows,
    msg,
    reasoning,
    subagentWindows,
    retryStatus,
    todosBySessionId,
    todoErrorBySessionId,
    normalizeTodoItems,
    notificationSessionOrder,
    upsertPermissionEntry,
    removePermissionEntry,
    upsertQuestionEntry,
    removeQuestionEntry,
    upsertMcpPermissionEntry,
    removeMcpPermissionEntry,
    applySessionStatusEvent,
    shellManager,
    treeNodes,
    expandedTreePathSet,
    selectedTreePath,
  } = options;

  watch(
    () => toolWindowCanvasEl.value,
    () => {
      updateFloatingExtentObserver();
    },
    { immediate: true },
  );

  watch(
    [projectDirectory, activeDirectory, selectedSessionId],
    ([pd, ad, sid], [prevPd, prevAd, prevSid] = ['', '', '']) => {
      if (isBootstrapping.value) return;
      const pdChanged = pd !== prevPd && typeof prevPd !== 'undefined';
      const adChanged = ad !== prevAd && typeof prevAd !== 'undefined';
      const sidChanged = sid !== prevSid && typeof prevSid !== 'undefined';
      if (!pdChanged && !adChanged) return;
      if (!sidChanged) {
        const _nextProjectId = (pd || selectedProjectId.value).trim();
        const _nextDirectory = ad.trim();
        void _nextProjectId;
        void _nextDirectory;
      }
      if (adChanged && ad) {
        void fetchCommands(ad);
      }
    },
    { immediate: true },
  );

  watch(
    filteredSessions,
    () => {
      if (!bootstrapReady.value && !isBootstrapping.value) return;
      if (isBootstrapping.value) return;
      if (!selectedSessionId.value) {
        const preferredId = pickPreferredSessionId(filteredSessions.value);
        if (preferredId) selectedSessionId.value = preferredId;
        return;
      }
      validateSelectedSession();
    },
    { immediate: true },
  );

  watch(
    uiInitState,
    (state) => {
      if (state !== 'ready') return;
      nextTick(() => {
        syncFloatingExtent();
        inputPanelRef.value?.focus();
        void shellManagerRestore.restoreShellSessions();
      });
    },
    { immediate: true },
  );

  watch(selectedSessionId, reloadSelectedSessionState, { immediate: true });

  watch([selectedProjectId, selectedSessionId], messageMeta.syncActiveSelectionToWorker, { immediate: true });

  watchEffect(() => {
    opencodeApi.setBaseUrl(credentials.baseUrl.value);
    opencodeApi.setAuthorization(credentials.authHeader.value);
  });

  watch(isThinking, (active) => {
    if (active) return;
    if (!selectedSessionId.value) return;
    updateReasoningExpiry(selectedSessionId.value, 'idle');
  });

  watch(selectedModel, () => {
    if (modelOptions.value.length === 0) return;
    const selectedInfo = modelOptions.value.find((model) => model.id === selectedModel.value);
    const nextThinkingOptions = buildThinkingOptions(selectedInfo?.variants);
    const sameThinking =
      nextThinkingOptions.length === thinkingOptions.value.length &&
      nextThinkingOptions.every((value, index) => value === thinkingOptions.value[index]);
    if (!sameThinking) thinkingOptions.value = nextThinkingOptions;
    if (selectedThinking.value === undefined || !nextThinkingOptions.includes(selectedThinking.value)) {
      selectedThinking.value = nextThinkingOptions[0];
    }
  });

  watch(activeDirectory, (directory) => {
    if (isBootstrapping.value) return;
    const activePath = directory || undefined;
    if (!activePath) {
      treeNodes.value = [];
      expandedTreePathSet.value = new Set();
      selectedTreePath.value = '';
      return;
    }
    if (activeDirectory.value && activePath !== activeDirectory.value) return;
    void fetchCommands(activePath);
    void reloadTodosForAllowedSessions();
  });

  watch(sidePanelCollapsed, () => {
    persistSidePanelCollapsed(sidePanelCollapsed.value);
  });

  watch(sidePanelActiveTab, () => {
    persistSidePanelTab(sidePanelActiveTab.value);
  });

  watch(
    allowedSessionIds,
    () => {
      void reloadTodosForAllowedSessions();
    },
    { immediate: true },
  );

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const globalEventUnsubscribers: Array<() => void> = [];

  onMounted(() => {
    messageMeta.ensureBrowserNotificationPermission();
    window.addEventListener('keydown', handleGlobalKeydown);
    handleWindowResize();
    if (typeof document !== 'undefined' && 'fonts' in document) {
      void document.fonts.ready.then(() => {
        handleWindowResize();
      });
    }
    credentials.load();

    if (credentials.isConfigured.value) {
      loginUrl.value = credentials.url.value;
      loginUsername.value = credentials.username.value;
      loginPassword.value = credentials.password.value;
      loginRequiresAuth.value = !!(credentials.username.value || credentials.password.value);
      void startInitialization();
    } else {
      uiInitState.value = 'login';
      const savedError = storageGet(StorageKeys.state.lastAuthError);
      if (savedError) {
        initErrorMessage.value = savedError;
        storageRemove(StorageKeys.state.lastAuthError);
      }
    }
    const availableThemes = getBundledThemeNames();
    const chosenTheme = pickShikiTheme(availableThemes);
    if (chosenTheme) shikiTheme.value = chosenTheme;
    window.addEventListener('pointermove', appLayout.handlePointerMove);
    window.addEventListener('pointerup', appLayout.handlePointerUp);
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('storage', handleComposerDraftStorage as any);
    document.addEventListener('visibilitychange', messageMetaHandleWindowAttentionChange);
    window.addEventListener('focus', messageMetaHandleWindowAttentionChange);
    window.addEventListener('blur', messageMetaHandleWindowAttentionChange);
    updateFloatingExtentObserver();
    globalEventUnsubscribers.push(
      ge.on('connection.open', () => {
        if (connectionState.value === 'reconnecting' || connectionState.value === 'error') {
          connectionState.value = 'ready';
          reconnectingMessage.value = '';
          sendStatus.value = 'Ready';
        }
        if (bootstrapReady.value) {
          messageMeta.syncActiveSelectionToWorker();
          return;
        }
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('connection.reconnected', () => {
        connectionState.value = 'ready';
        reconnectingMessage.value = '';
        sendStatus.value = 'Ready';
        messageMeta.syncActiveSelectionToWorker();
        void fetchProviders(true);
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('connection.error', (payload: any) => {
        if (payload.statusCode === 401 || payload.statusCode === 403) {
          const m = `${payload.message} (HTTP ${payload.statusCode})`;
          storageSet(StorageKeys.state.lastAuthError, m);
          credentialsClear();
          uiInitState.value = 'login';
          initErrorMessage.value = m;
          connectionState.value = 'error';
          return;
        }
        if (uiInitState.value === 'loading') {
          connectionState.value = 'error';
          initErrorMessage.value = 'Failed to connect to SSE stream.';
          uiInitState.value = 'login';
          return;
        }
        connectionState.value = 'reconnecting';
        reconnectingMessage.value = 'Reconnecting...';
      }),
    );
    globalEventUnsubscribers.push(
      sessionScope.on('permission.asked', (packet: any) => {
        upsertPermissionEntry(packet);
      }),
    );
    globalEventUnsubscribers.push(
      sessionScope.on('permission.replied', ({ requestID }: any) => {
        removePermissionEntry(requestID);
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('permission.replied', ({ requestID }: any) => {
        removePermissionEntry(requestID);
      }),
    );
    globalEventUnsubscribers.push(
      sessionScope.on('question.asked', (packet: any) => {
        upsertQuestionEntry(packet);
      }),
    );
    globalEventUnsubscribers.push(
      sessionScope.on('question.replied', ({ requestID }: any) => {
        removeQuestionEntry(requestID);
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('question.replied', ({ requestID }: any) => {
        removeQuestionEntry(requestID);
      }),
    );
    globalEventUnsubscribers.push(
      sessionScope.on('question.rejected', ({ requestID }: any) => {
        removeQuestionEntry(requestID);
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('question.rejected', ({ requestID }: any) => {
        removeQuestionEntry(requestID);
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('worktree.ready', () => {}),
    );
    globalEventUnsubscribers.push(
      ge.on('session.updated', () => {
        validateSelectedSession();
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('session.deleted', ({ info }: any) => {
        const sessionInfo = info as any;
        notificationSessionOrder.value = notificationSessionOrder.value.filter(
          (key) => key !== sessionInfo.id,
        );
        validateSelectedSession();
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('file.watcher.updated', (_packet: any) => {}),
    );
    globalEventUnsubscribers.push(
      ge.on('session.status', ({ sessionID, status }: any) => {
        applySessionStatusEvent(sessionID, status);
      }),
    );
    globalEventUnsubscribers.push(
      sessionScope.on('todo.updated', ({ sessionID, todos }: any) => {
        todosBySessionId.value = { ...todosBySessionId.value, [sessionID]: normalizeTodoItems(todos) };
        if (todoErrorBySessionId.value[sessionID]) {
          const nextErrors = { ...todoErrorBySessionId.value };
          delete nextErrors[sessionID];
          todoErrorBySessionId.value = nextErrors;
        }
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('pty.created', ({ info }: any) => {
        shellManager.handlePtyEvent({ type: 'pty.created', info });
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('pty.updated', ({ info }: any) => {
        shellManager.handlePtyEvent({ type: 'pty.updated', info });
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('pty.exited', ({ id, exitCode }: any) => {
        shellManager.handlePtyEvent({ type: 'pty.exited', info: null, id, exitCode });
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('pty.deleted', ({ id }: any) => {
        shellManager.lingerAndRemoveShellWindow(id);
      }),
    );
    globalEventUnsubscribers.push(
      sessionScope.on('mcp.permission.request', (packet: any) => {
        upsertMcpPermissionEntry(packet);
      }),
    );
    globalEventUnsubscribers.push(
      ge.on('mcp.tool.call', (packet: any) => {
        if (suppressAutoWindows.value) return;
        const sessionId = packet?.sessionID;
        if (sessionId && !allowedSessionIds.value.has(sessionId)) return;
        const callId = packet?.callID ?? `mcp:${packet?.server}:${packet?.tool}`;
        fw.open(`mcp-tool:${callId}`, {
          component: undefined,
          props: undefined,
          content: JSON.stringify(
            {
              server: packet?.server,
              tool: packet?.tool,
              arguments: packet?.arguments,
            },
            null,
            2,
          ),
          lang: 'json',
          title: `MCP: ${packet?.server} / ${packet?.tool}`,
          color: '#2dd4bf',
          status: 'running',
          closable: true,
          resizable: true,
          scroll: 'manual',
          expiry: Infinity,
        });
      }),
    );
    globalEventUnsubscribers.push(
      sessionScope.on('message.part.updated', ({ part }: any) => {
        if (part.type !== 'tool') return;
        if (suppressAutoWindows.value) return;
        toolWindows.openToolPartAsWindow(part);
      }),
    );
  });

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleGlobalKeydown);
    window.removeEventListener('pointermove', appLayout.handlePointerMove);
    window.removeEventListener('pointerup', appLayout.handlePointerUp);
    window.removeEventListener('resize', handleWindowResize);
    window.removeEventListener('storage', handleComposerDraftStorage as any);
    document.removeEventListener('visibilitychange', messageMetaHandleWindowAttentionChange);
    window.removeEventListener('focus', messageMetaHandleWindowAttentionChange);
    window.removeEventListener('blur', messageMetaHandleWindowAttentionChange);
    while (globalEventUnsubscribers.length > 0) {
      const dispose = globalEventUnsubscribers.pop();
      dispose?.();
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    mainSessionScope.dispose();
    sessionScope.dispose();
    ge.disconnect();
    shellManager.disposeShellWindows();
  });
}
