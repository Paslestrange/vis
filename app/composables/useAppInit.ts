import { ref } from 'vue';
import type { Ref } from 'vue';
import * as opencodeApi from '../utils/opencode';
import { toErrorMessage } from '../utils/formatters';
import {
  StorageKeys,
  storageGet,
  storageRemove,
  storageSet,
} from '../utils/storageKeys';

export function useAppInit(options: {
  credentials: {
    baseUrl: Ref<string>;
    authHeader: Ref<string>;
    url: Ref<string>;
    username: Ref<string>;
    password: Ref<string>;
    isConfigured: Ref<boolean>;
    save: (url: string, username: string, password: string) => void;
    clear: () => void;
    load: () => void;
  };
  ge: {
    connect: (opts: { failFast: boolean; timeoutMs: number }) => Promise<void>;
    disconnect: () => void;
    on: (event: string, handler: (payload?: unknown) => void) => (() => void);
  };
  bootstrapReady: Ref<boolean>;
  selectedSessionId: Ref<string>;
  activeDirectory: Ref<string>;
  fetchProviders: (force?: boolean) => Promise<void>;
  fetchAgents: () => Promise<void>;
  fetchCommands: (directory?: string) => Promise<void>;
  fetchPendingPermissions: (directory?: string) => Promise<void>;
  fetchPendingQuestions: (directory?: string) => Promise<void>;
  bootstrapSelections: () => Promise<void>;
  reloadSelectedSessionState: () => Promise<void>;
  refreshGitStatus: () => Promise<void>;
  shellManager: { disposeShellWindows: () => void };
  messageMeta: { syncActiveSelectionToWorker: () => void };
  sendStatus: Ref<string>;
  opencodeApi: {
    setBaseUrl: (url: string) => void;
    setAuthorization: (auth: string) => void;
    getPathInfo: () => Promise<unknown>;
  };
  serverWorktreePath: Ref<string>;
  homePath: Ref<string>;
}) {
  const {
    credentials,
    ge,
    bootstrapReady,
    selectedSessionId,
    activeDirectory,
    fetchProviders,
    fetchAgents,
    fetchCommands,
    fetchPendingPermissions,
    fetchPendingQuestions,
    bootstrapSelections,
    reloadSelectedSessionState,
    refreshGitStatus,
    shellManager,
    messageMeta,
    sendStatus,
    opencodeApi: opencodeApiInstance,
    serverWorktreePath,
    homePath,
  } = options;

  const uiInitState = ref<'loading' | 'ready' | 'error' | 'login'>('loading');
  const initLoadingMessage = ref('Connecting to server...');
  const initErrorMessage = ref('');
  const connectionState = ref<'connecting' | 'bootstrapping' | 'ready' | 'reconnecting' | 'error'>(
    'connecting',
  );
  const reconnectingMessage = ref('');
  let initializationInFlight = false;
  const loginUrl = ref('http://localhost:4096');
  const loginUsername = ref('');
  const loginPassword = ref('');
  const loginRequiresAuth = ref(false);

  async function fetchHomePath() {
    try {
      const data = (await opencodeApi.getPathInfo()) as {
        home?: string;
        worktree?: string;
      };
      if (typeof data.home === 'string' && data.home.trim()) {
        homePath.value = data.home.trim();
      }
      if (typeof data.worktree === 'string' && data.worktree.trim()) {
        serverWorktreePath.value = data.worktree.trim();
      }
    } catch {
      return;
    }
  }

  async function startInitialization() {
    if (initializationInFlight) return;
    initializationInFlight = true;
    uiInitState.value = 'loading';
    initErrorMessage.value = '';
    reconnectingMessage.value = '';
    try {
      connectionState.value = 'connecting';
      initLoadingMessage.value = 'Connecting to SSE stream...';
      await ge.connect({ failFast: true, timeoutMs: 10000 });
      connectionState.value = 'bootstrapping';
      initLoadingMessage.value = 'Loading server path...';
      await fetchHomePath();
      initLoadingMessage.value = 'Loading projects and sessions...';
      await bootstrapSelections();
      if (selectedSessionId.value) {
        initLoadingMessage.value = 'Loading session history...';
        await reloadSelectedSessionState();
      }
      if (activeDirectory.value) {
        initLoadingMessage.value = 'Loading worktree state...';
        await fetchCommands(activeDirectory.value || undefined);
        const directory = activeDirectory.value || undefined;
        await fetchPendingPermissions(directory);
        await fetchPendingQuestions(directory);
        void refreshGitStatus();
      }
      connectionState.value = 'ready';
      uiInitState.value = 'ready';
      await fetchProviders();
      await fetchAgents();
    } catch (error) {
      if (!initializationInFlight) return;
      ge.disconnect();
      const msg = toErrorMessage(error);
      connectionState.value = 'error';
      if (/\(40[13]\)/.test(msg)) {
        storageSet(StorageKeys.state.lastAuthError, msg);
        credentials.clear();
        initErrorMessage.value = msg;
        uiInitState.value = 'login';
      } else {
        initErrorMessage.value = msg;
        uiInitState.value = 'login';
      }
    } finally {
      initializationInFlight = false;
    }
  }

  function handleLogin() {
    const u = loginRequiresAuth.value ? loginUsername.value : '';
    const p = loginRequiresAuth.value ? loginPassword.value : '';
    credentials.save(loginUrl.value, u, p);
    void startInitialization();
  }

  function handleAbortInit() {
    ge.disconnect();
    initializationInFlight = false;
    connectionState.value = 'connecting';
    uiInitState.value = 'login';
    initErrorMessage.value = '';
  }

  function handleLogout() {
    credentials.clear();
    ge.disconnect();
    shellManager.disposeShellWindows();
    uiInitState.value = 'login';
    initErrorMessage.value = '';
    connectionState.value = 'connecting';
  }

  return {
    uiInitState,
    initLoadingMessage,
    initErrorMessage,
    connectionState,
    reconnectingMessage,
    loginUrl,
    loginUsername,
    loginPassword,
    loginRequiresAuth,
    startInitialization,
    handleLogin,
    handleAbortInit,
    handleLogout,
  };
}
