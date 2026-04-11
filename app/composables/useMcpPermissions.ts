import { ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import McpPermissionContent from '../components/ToolWindow/McpPermission.vue';
import * as opencodeApi from '../utils/opencode';
import type { useFloatingWindows } from './useFloatingWindows';

export type McpPermissionRequest = {
  id: string;
  sessionID: string;
  server: string;
  tool: string;
  arguments: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type McpPermissionReply = 'once' | 'always' | 'reject';

const PERMISSION_WINDOW_WIDTH = 760;
const PERMISSION_WINDOW_HEIGHT = 420;

export function useMcpPermissions(options: {
  fw: ReturnType<typeof useFloatingWindows>;
  allowedSessionIds: ComputedRef<Set<string>>;
  activeDirectory: Ref<string>;
  ensureConnectionReady: (action: string) => boolean;
}) {
  const permissionSendingById = ref<Record<string, boolean>>({});
  const permissionErrorById = ref<Record<string, string>>({});

  function parsePermissionRequest(
    value: unknown,
    fallbackSessionId?: string,
  ): McpPermissionRequest | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : undefined;
    const sessionID =
      (typeof record.sessionID === 'string' && record.sessionID) ||
      (typeof record.sessionId === 'string' && record.sessionId) ||
      fallbackSessionId;
    const server = typeof record.server === 'string' ? record.server : undefined;
    const tool = typeof record.tool === 'string' ? record.tool : undefined;
    const args =
      record.arguments && typeof record.arguments === 'object'
        ? (record.arguments as Record<string, unknown>)
        : {};
    const metadata =
      record.metadata && typeof record.metadata === 'object'
        ? (record.metadata as Record<string, unknown>)
        : {};
    if (!id || !sessionID || !server || !tool) return null;
    return { id, sessionID, server, tool, arguments: args, metadata };
  }

  function setPermissionSending(requestId: string, value: boolean) {
    const next = { ...permissionSendingById.value };
    if (value) next[requestId] = true;
    else delete next[requestId];
    permissionSendingById.value = next;
  }

  function clearPermissionSending(requestId: string) {
    setPermissionSending(requestId, false);
  }

  function setPermissionError(requestId: string, message: string) {
    const next = { ...permissionErrorById.value };
    if (message) next[requestId] = message;
    else delete next[requestId];
    permissionErrorById.value = next;
  }

  function clearPermissionError(requestId: string) {
    setPermissionError(requestId, '');
  }

  function isPermissionSubmitting(requestId: string): boolean {
    return Boolean(permissionSendingById.value[requestId]);
  }

  function getPermissionError(requestId: string): string {
    return permissionErrorById.value[requestId] ?? '';
  }

  function isPermissionSessionAllowed(request: McpPermissionRequest): boolean {
    const allowed = options.allowedSessionIds.value;
    if (!request.sessionID) return false;
    if (allowed.size === 0) return false;
    return allowed.has(request.sessionID);
  }

  function upsertPermissionEntry(request: McpPermissionRequest) {
    const key = `mcp-permission:${request.id}`;
    options.fw.open(key, {
      component: McpPermissionContent,
      props: {
        request,
        isSubmitting: isPermissionSubmitting(request.id),
        error: getPermissionError(request.id),
        onReply: handlePermissionReply,
      },
      closable: false,
      resizable: false,
      scroll: 'manual',
      color: '#f59e0b',
      title: `MCP: ${request.server} / ${request.tool}`,
      width: PERMISSION_WINDOW_WIDTH,
      height: PERMISSION_WINDOW_HEIGHT,
      expiry: Infinity,
    });
  }

  function refreshPermissionWindow(requestId: string) {
    const key = `mcp-permission:${requestId}`;
    const entry = options.fw.get(key);
    if (!entry) return;
    options.fw.updateOptions(key, {
      props: {
        ...entry.props,
        isSubmitting: isPermissionSubmitting(requestId),
        error: getPermissionError(requestId),
      },
    });
  }

  function removePermissionEntry(requestId: string) {
    options.fw.close(`mcp-permission:${requestId}`);
    clearPermissionSending(requestId);
    clearPermissionError(requestId);
  }

  function prunePermissionEntries() {
    const allowed = options.allowedSessionIds.value;
    for (const entry of options.fw.entries.value) {
      if (!entry.key.startsWith('mcp-permission:')) continue;
      const request = entry.props?.request as McpPermissionRequest | undefined;
      if (!request) continue;
      if (!allowed.has(request.sessionID)) {
        removePermissionEntry(request.id);
      }
    }
  }

  async function sendPermissionReply(requestId: string, reply: McpPermissionReply) {
    if (!options.ensureConnectionReady('MCP permission reply')) return;
    const directory = options.activeDirectory.value.trim();
    await opencodeApi.replyPermission(requestId, {
      directory: directory || undefined,
      reply,
    });
  }

  async function handlePermissionReply(payload: { requestId: string; reply: McpPermissionReply }) {
    if (!options.ensureConnectionReady('MCP permission reply')) return;
    const { requestId, reply } = payload;
    if (isPermissionSubmitting(requestId)) return;
    clearPermissionError(requestId);
    setPermissionSending(requestId, true);
    refreshPermissionWindow(requestId);
    try {
      await sendPermissionReply(requestId, reply);
      removePermissionEntry(requestId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setPermissionError(requestId, errorMessage);
      refreshPermissionWindow(requestId);
    } finally {
      clearPermissionSending(requestId);
      refreshPermissionWindow(requestId);
    }
  }

  return {
    parsePermissionRequest,
    upsertPermissionEntry,
    removePermissionEntry,
    prunePermissionEntries,
    upsertMcpPermissionEntry: upsertPermissionEntry,
    removeMcpPermissionEntry: removePermissionEntry,
    pruneMcpPermissionEntries: prunePermissionEntries,
    handlePermissionReply,
    isPermissionSessionAllowed,
  };
}
