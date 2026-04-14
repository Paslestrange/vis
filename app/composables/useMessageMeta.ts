import type { Ref } from 'vue';
import * as opencodeApi from '../utils/opencode';
import type { useMessages } from './useMessages';
import type { useGlobalEvents } from './useGlobalEvents';

type SessionInfo = {
  id: string;
  title?: string;
  slug?: string;
};

type ProviderInfo = {
  id: string;
  models?: Record<
    string,
    {
      limit?: {
        context?: number;
        input?: number;
        output?: number;
      };
    }
  >;
};

export type UserMessageMeta = {
  agent?: string;
  providerId?: string;
  modelId?: string;
  variant?: string;
};

export type MessageTokens = {
  input: number;
  output: number;
  reasoning: number;
  cache?: {
    read: number;
    write: number;
  };
};

const historyCache = new Map<string, Array<Record<string, unknown>>>();
const HISTORY_CACHE_MAX_SIZE = 10;

export function useMessageMeta(deps: {
  notificationPermissionRequested: Ref<boolean>;
  sessions: () => SessionInfo[];
  resolveProjectIdForSession: (sessionId: string) => string;
  sessionLabel: (session: SessionInfo) => string;
  switchSessionSelection: (projectId: string, sessionId: string) => Promise<void>;
  selectedProjectId: Ref<string>;
  selectedSessionId: Ref<string>;
  providers: Ref<ProviderInfo[]>;
  userMessageMetaById: Ref<Record<string, UserMessageMeta>>;
  userMessageTimeById: Ref<Record<string, number>>;
  msg: ReturnType<typeof useMessages>;
  primaryHistoryRequestId: { value: number };
  getSelectedWorktreeDirectory: () => string;
  notifyContentChange: (smooth?: boolean) => void;
  ge: ReturnType<typeof useGlobalEvents>;
}) {
  const {
    notificationPermissionRequested,
    sessions,
    resolveProjectIdForSession,
    sessionLabel,
    switchSessionSelection,
    selectedProjectId,
    selectedSessionId,
    providers,
    userMessageMetaById,
    userMessageTimeById,
    msg,
    primaryHistoryRequestId,
    getSelectedWorktreeDirectory,
    notifyContentChange,
    ge,
  } = deps;

  function ensureBrowserNotificationPermission() {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    if (notificationPermissionRequested.value) return;
    notificationPermissionRequested.value = true;
    void Notification.requestPermission();
  }

  function isWindowAttentive(): boolean {
    if (typeof document === 'undefined') return true;
    return !document.hidden && document.hasFocus();
  }

  function showBrowserNotification(
    projectId: string,
    sessionId: string,
    type: 'permission' | 'question' | 'idle',
  ) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (typeof Notification === 'undefined') return;
    if (isWindowAttentive()) return;
    if (Notification.permission !== 'granted') return;
    const session = sessions().find(
      (entry) =>
        entry.id === sessionId && resolveProjectIdForSession(entry.id) === projectId,
    );
    const kind =
      type === 'permission' ? 'Permission' : type === 'question' ? 'Question' : 'Task done';
    const body =
      type === 'idle'
        ? session
          ? `Task done in ${sessionLabel(session)}`
          : `Task done in session ${sessionId}`
        : session
          ? `${sessionLabel(session)} requires your response.`
          : `Session ${sessionId} requires your response.`;
    const notification = new Notification(`${kind}`, {
      body,
      tag: `vis-${type}-${projectId}-${sessionId}`,
    });
    notification.onclick = () => {
      window.focus();
      void switchSessionSelection(projectId.trim(), sessionId.trim());
      notification.close();
    };
  }

  function syncActiveSelectionToWorker() {
    ge.sendToWorker({
      type: 'selection.active',
      projectId: isWindowAttentive() ? selectedProjectId.value : '',
      sessionId: isWindowAttentive() ? selectedSessionId.value : '',
    });
  }

  function handleWindowAttentionChange() {
    syncActiveSelectionToWorker();
  }

  function parseMessageTime(info?: Record<string, unknown>): number | undefined {
    if (!info) return undefined;
    const time = info.time as Record<string, unknown> | undefined;
    if (!time || typeof time !== 'object') return undefined;
    const created = time.created;
    return typeof created === 'number' ? created : undefined;
  }

  function parseUserMessageMeta(info?: Record<string, unknown>): UserMessageMeta | null {
    if (!info) return null;
    const agent = typeof info.agent === 'string' ? info.agent.trim() : '';
    const model = (info.model as Record<string, unknown> | undefined) ?? undefined;
    const providerId =
      typeof info.providerID === 'string'
        ? info.providerID.trim()
        : typeof model?.providerID === 'string'
          ? (model.providerID as string).trim()
          : '';
    const modelId =
      typeof info.modelID === 'string'
        ? String(info.modelID).trim()
        : typeof model?.modelID === 'string'
          ? String(model.modelID).trim()
          : '';
    const variant = typeof info.variant === 'string' ? info.variant.trim() : '';
    if (!agent && !modelId && !providerId && !variant) return null;
    return {
      agent: agent || undefined,
      providerId: providerId || undefined,
      modelId: modelId || undefined,
      variant: variant || undefined,
    };
  }

  function resolveProviderModelLimit(providerId?: string, modelId?: string) {
    const normalizedProvider = providerId?.trim() ?? '';
    const normalizedModel = modelId?.trim() ?? '';
    if (!normalizedProvider || !normalizedModel) return null;
    const provider = providers.value.find((item) => item.id === normalizedProvider);
    if (!provider) return null;
    const model = provider.models?.[normalizedModel];
    if (!model || !model.limit) return null;
    return model.limit;
  }

  function computeContextPercent(tokens: MessageTokens, providerId?: string, modelId?: string) {
    const limit = resolveProviderModelLimit(providerId, modelId);
    const contextLimit = limit?.context;
    if (!contextLimit || !Number.isFinite(contextLimit) || contextLimit <= 0) return null;
    const total =
      tokens.input + tokens.output + (tokens.cache?.read ?? 0) + (tokens.cache?.write ?? 0);
    if (!Number.isFinite(total) || total <= 0) return 0;
    return Math.round((total / contextLimit) * 100);
  }

  function storeUserMessageMeta(messageId: string | undefined, meta: UserMessageMeta | null) {
    if (!messageId || !meta) return;
    userMessageMetaById.value = { ...userMessageMetaById.value, [messageId]: meta };
  }

  function storeUserMessageTime(messageId: string | undefined, messageTime?: number) {
    if (!messageId || typeof messageTime !== 'number') return;
    userMessageTimeById.value = { ...userMessageTimeById.value, [messageId]: messageTime };
  }

  function getCachedHistory(sessionId: string): Array<Record<string, unknown>> | undefined {
    return historyCache.get(sessionId);
  }

  function setCachedHistory(sessionId: string, data: Array<Record<string, unknown>>) {
    if (historyCache.size >= HISTORY_CACHE_MAX_SIZE) {
      const firstKey = historyCache.keys().next().value;
      if (firstKey !== undefined) {
        historyCache.delete(firstKey);
      }
    }
    historyCache.set(sessionId, data);
  }

  function loadCachedHistory(sessionId: string) {
    const cached = getCachedHistory(sessionId);
    if (!cached) return false;
    msg.loadHistory(cached);
    cached.forEach((message) => {
      const info = message.info as Record<string, unknown> | undefined;
      const id = typeof info?.id === 'string' ? info.id : undefined;
      if (!id) return;
      const meta = parseUserMessageMeta(info);
      const messageTime = parseMessageTime(info);
      storeUserMessageMeta(id, meta);
      storeUserMessageTime(id, messageTime);
    });
    notifyContentChange(false);
    return true;
  }

  async function fetchHistory(sessionId: string, isSubagentMessage = false) {
    if (!sessionId) return;
    const requestId = !isSubagentMessage ? ++primaryHistoryRequestId.value : 0;
    const requestedDirectory = !isSubagentMessage ? getSelectedWorktreeDirectory() : '';
    try {
      const directory = getSelectedWorktreeDirectory();
      const data = (await opencodeApi.listSessionMessages(sessionId, {
        directory: directory || undefined,
      })) as Array<Record<string, unknown>>;
      if (!Array.isArray(data)) return;
      if (!isSubagentMessage) {
        if (requestId !== primaryHistoryRequestId.value) return;
        if (selectedSessionId.value !== sessionId) return;
        if (getSelectedWorktreeDirectory() !== requestedDirectory) return;
        setCachedHistory(sessionId, data);
      }
      msg.loadHistory(data);

      data.forEach((message) => {
        const info = message.info as Record<string, unknown> | undefined;
        const id = typeof info?.id === 'string' ? info.id : undefined;
        if (!id) return;
        const meta = parseUserMessageMeta(info);
        const messageTime = parseMessageTime(info);
        storeUserMessageMeta(id, meta);
        storeUserMessageTime(id, messageTime);
      });

      if (!isSubagentMessage) {
        notifyContentChange(false);
      }
    } catch {}
  }

  return {
    ensureBrowserNotificationPermission,
    isWindowAttentive,
    showBrowserNotification,
    syncActiveSelectionToWorker,
    handleWindowAttentionChange,
    parseMessageTime,
    parseUserMessageMeta,
    resolveProviderModelLimit,
    computeContextPercent,
    storeUserMessageMeta,
    storeUserMessageTime,
    fetchHistory,
    loadCachedHistory,
    getCachedHistory,
  };
}
