import type { Ref } from 'vue';
import * as opencodeApi from '../utils/opencode';
import type { useOpenCodeApi } from './useOpenCodeApi';
import { toErrorMessage } from '../utils/formatters';

type SessionInfo = {
  id: string;
  projectID?: string;
  projectId?: string;
  parentID?: string;
  title?: string;
  slug?: string;
  status?: 'busy' | 'idle' | 'retry';
  directory?: string;
  time?: {
    created?: number;
    updated?: number;
    archived?: number;
  };
  revert?: {
    messageID: string;
    partID?: string;
    snapshot?: string;
    diff?: string;
  };
};

export function useSessionMutations(deps: {
  selectedProjectId: Ref<string>;
  selectedSessionId: Ref<string>;
  activeDirectory: Ref<string>;
  sessionError: Ref<string>;
  sendStatus: Ref<string>;
  ensureConnectionReady: (action: string) => boolean;
  openCodeApi: ReturnType<typeof useOpenCodeApi>;
  switchSessionSelection: (projectId: string, sessionId: string) => Promise<void>;
  reloadSelectedSessionState: () => Promise<void>;
  seedForkedSessionComposerDraft?: (
    payload: { sessionId: string; messageId: string },
    forkedSession: SessionInfo,
  ) => void;
}) {
  const {
    selectedProjectId,
    selectedSessionId,
    activeDirectory,
    sessionError,
    sendStatus,
    ensureConnectionReady,
    openCodeApi,
    switchSessionSelection,
    reloadSelectedSessionState,
    seedForkedSessionComposerDraft,
  } = deps;

  async function deleteSession(sessionId: string) {
    if (!ensureConnectionReady('Deleting session')) return;
    sessionError.value = '';
    if (!sessionId) return;
    try {
      const directory = activeDirectory.value.trim();
      await openCodeApi.deleteSession({
        sessionId,
        projectId: selectedProjectId.value,
        directory: directory || undefined,
      });
    } catch (error) {
      sessionError.value = `Session delete failed: ${toErrorMessage(error)}`;
    }
  }

  async function archiveSession(sessionId: string) {
    if (!ensureConnectionReady('Archiving session')) return;
    sessionError.value = '';
    if (!sessionId) return;
    try {
      const directory = activeDirectory.value.trim();
      await openCodeApi.archiveSession({
        sessionId,
        projectId: selectedProjectId.value,
        directory: directory || undefined,
      });
    } catch (error) {
      sessionError.value = `Session archive failed: ${toErrorMessage(error)}`;
    }
  }

  async function handleForkMessage(payload: { sessionId: string; messageId: string }) {
    if (!ensureConnectionReady('Fork')) return;
    sessionError.value = '';
    try {
      sendStatus.value = 'Forking...';
      const data = (await openCodeApi.forkSession({
        sessionId: payload.sessionId,
        messageId: payload.messageId,
        directory: activeDirectory.value.trim() || undefined,
        projectId: selectedProjectId.value,
      })) as SessionInfo;
      if (data && typeof data.id === 'string') {
        seedForkedSessionComposerDraft?.(payload, data);
        await switchSessionSelection(selectedProjectId.value, data.id);
      }
      sendStatus.value = 'Forked.';
    } catch (error) {
      sessionError.value = `Session fork failed: ${toErrorMessage(error)}`;
    }
  }

  async function handleRevertMessage(payload: { sessionId: string; messageId: string }) {
    if (!ensureConnectionReady('Revert')) return;
    sessionError.value = '';
    try {
      sendStatus.value = 'Reverting...';
      await openCodeApi.revertSession({
        sessionId: payload.sessionId,
        messageId: payload.messageId,
        projectId: selectedProjectId.value,
        directory: activeDirectory.value.trim() || undefined,
      });
      sendStatus.value = 'Reverted.';
      if (selectedSessionId.value === payload.sessionId) void reloadSelectedSessionState();
    } catch (error) {
      sessionError.value = `Session revert failed: ${toErrorMessage(error)}`;
    }
  }

  async function handleUndoRevert() {
    const sessionId = selectedSessionId.value;
    if (!sessionId) return;
    if (!ensureConnectionReady('Undo')) return;
    sessionError.value = '';
    try {
      sendStatus.value = 'Undoing...';
      await openCodeApi.unrevertSession({
        sessionId,
        projectId: selectedProjectId.value,
        directory: activeDirectory.value.trim() || undefined,
      });
      sendStatus.value = 'Undone.';
    } catch (error) {
      sessionError.value = `Session undo failed: ${toErrorMessage(error)}`;
    }
  }

  return {
    deleteSession,
    archiveSession,
    handleForkMessage,
    handleRevertMessage,
    handleUndoRevert,
  };
}
