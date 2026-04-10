import { computed, ref, type Ref } from 'vue';
import { toErrorMessage } from '../utils/formatters';
import type { Attachment } from './useComposerDrafts';

type CommandInfo = {
  name: string;
  description?: string;
  agent?: string;
  model?: string;
  source?: string;
  template?: string;
  hints?: string[];
};

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

type ModelOption = {
  id: string;
  modelID: string;
  label: string;
  displayName: string;
  providerID?: string;
  providerLabel?: string;
  variants?: Record<string, unknown>;
  attachmentCapable?: boolean;
};

export interface UseChatActionsOptions {
  ensureConnectionReady: (action: string) => boolean;
  activeDirectory: Ref<string>;
  selectedSessionId: Ref<string>;
  filteredSessions: Ref<SessionInfo[]>;
  messageInput: Ref<string>;
  attachments: Ref<Attachment[]>;
  selectedMode: Ref<string>;
  selectedModel: Ref<string>;
  selectedThinking: Ref<string | undefined>;
  modelOptions: Ref<ModelOption[]>;
  parseProviderModelKey: (value: string) => { providerID: string; modelID: string };
  opencodeApi: {
    sendCommand: (
      sessionId: string,
      payload: {
        directory?: string;
        command: string;
        arguments: string;
        agent?: string;
        model?: string;
        variant?: string;
      },
    ) => Promise<void>;
    sendPromptAsync: (
      sessionId: string,
      payload: {
        directory: string;
        agent: string;
        model: { providerID?: string; modelID: string };
        variant?: string;
        parts: Array<Record<string, unknown>>;
      },
    ) => Promise<void>;
    abortSession: (sessionId: string, directory?: string) => Promise<void>;
  };
  shellManager: {
    openShellFromInput: (input: string) => Promise<void>;
  };
  runAppDebugCommand: (args: string) => { ok: boolean; message: string };
  commands: Ref<CommandInfo[]>;
  requireSelectedWorktree: (_context: 'send') => string;
  enableFollow: () => void;
  clearComposerDraftForCurrentContext: () => void;
  busyDescendantSessionIds: Ref<string[]>;
  isThinking: Ref<boolean>;
  uiInitState: Ref<'loading' | 'ready' | 'error' | 'login'>;
  connectionState: Ref<'connecting' | 'bootstrapping' | 'ready' | 'reconnecting' | 'error'>;
  sendStatus: Ref<string>;
  pickPreferredSessionId: (list: SessionInfo[]) => string;
}

export function useChatActions(options: UseChatActionsOptions) {
  const isSending = ref(false);
  const isAborting = ref(false);
  const recentUserInputs: { text: string; time: number }[] = [];

  const canSend = computed(() =>
    Boolean(
      options.uiInitState.value === 'ready' &&
        options.connectionState.value === 'ready' &&
        options.selectedSessionId.value &&
        !isSending.value &&
        (options.messageInput.value.trim().length > 0 || options.attachments.value.length > 0),
    ),
  );

  const canAbort = computed(() =>
    Boolean(
      options.uiInitState.value === 'ready' &&
        options.connectionState.value === 'ready' &&
        options.selectedSessionId.value &&
        options.isThinking.value &&
        !isAborting.value,
    ),
  );

  const commandOptions = computed(() => {
    const list = options.commands.value.slice();
    const hasShell = list.some((command) => command.name.toLowerCase() === 'shell');
    if (!hasShell) {
      list.push({
        name: 'shell',
        description: 'Open a local shell session.',
        source: 'local',
      });
    }
    const hasDebug = list.some((command) => command.name.toLowerCase() === 'debug');
    if (!hasDebug) {
      list.push({
        name: 'debug',
        description: 'Debug utilities. Use /debug help for subcommands.',
        source: 'local',
      });
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  });

  function parseSlashCommand(input: string) {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return null;
    const match = trimmed.slice(1).match(/^(\S+)(?:\s+(.*))?$/);
    if (!match) return null;
    const name = match[1]?.trim();
    if (!name) return null;
    const args = match[2] ?? '';
    return { name, arguments: args };
  }

  function findCommandByName(name: string) {
    const target = name.toLowerCase();
    return options.commands.value.find((command) => command.name.toLowerCase() === target) ?? null;
  }

  async function sendCommand(sessionId: string, command: CommandInfo, commandArgs: string) {
    if (!options.ensureConnectionReady('Sending commands')) return;
    const directory = options.activeDirectory.value.trim();
    await options.opencodeApi.sendCommand(sessionId, {
      directory: directory || undefined,
      command: command.name,
      arguments: commandArgs,
      agent: command.agent || options.selectedMode.value,
      model: command.model || options.selectedModel.value,
      variant: options.selectedThinking.value,
    });
  }

  async function sendMessage() {
    if (!options.ensureConnectionReady('Sending')) return;
    if (!canSend.value) return;
    const text = options.messageInput.value.trim();
    const hasText = text.length > 0;
    const hasAttachments = options.attachments.value.length > 0;
    let sessionId = options.selectedSessionId.value;
    if ((!hasText && !hasAttachments) || !sessionId) return;
    if (!options.filteredSessions.value.some((session) => session.id === sessionId)) {
      const fallbackId = options.pickPreferredSessionId(options.filteredSessions.value);
      const fallback = fallbackId
        ? options.filteredSessions.value.find((session) => session.id === fallbackId)
        : options.filteredSessions.value[0];
      if (!fallback) {
        options.sendStatus.value = 'No session selected.';
        return;
      }
      options.selectedSessionId.value = fallback.id;
      sessionId = fallback.id;
    }
    const slash = hasText ? parseSlashCommand(text) : null;
    const commandMatch = slash ? findCommandByName(slash.name) : null;
    const selectedInfo = options.modelOptions.value.find((model) => model.id === options.selectedModel.value);
    const selectedModelIDs = options.parseProviderModelKey(options.selectedModel.value);
    const providerID = selectedInfo?.providerID ?? (selectedModelIDs.providerID || undefined);
    const modelID = selectedInfo?.modelID ?? (selectedModelIDs.modelID || undefined);
    if (hasText) {
      recentUserInputs.push({ text, time: Date.now() });
      while (recentUserInputs.length > 20) recentUserInputs.shift();
    }
    options.messageInput.value = '';
    options.enableFollow();
    isSending.value = true;
    options.sendStatus.value = 'Sending...';
    try {
      if (slash && slash.name.toLowerCase() === 'shell') {
        await options.shellManager.openShellFromInput(slash.arguments ?? '');
        options.sendStatus.value = 'Shell ready.';
        options.clearComposerDraftForCurrentContext();
        return;
      }
      if (slash && slash.name.toLowerCase() === 'debug') {
        const debugResult = options.runAppDebugCommand(slash.arguments ?? '');
        options.sendStatus.value = debugResult.message;
        options.clearComposerDraftForCurrentContext();
        return;
      }
      if (slash && commandMatch) {
        await sendCommand(sessionId, commandMatch, slash.arguments ?? '');
        options.sendStatus.value = 'Sent.';
        options.clearComposerDraftForCurrentContext();
        return;
      }
      const directory = options.requireSelectedWorktree('send');
      if (!directory) return;
      const parts = [] as Array<Record<string, unknown>>;
      if (hasText) parts.push({ type: 'text', text });
      if (hasAttachments) {
        parts.push(
          ...options.attachments.value.map((item) => ({
            type: 'file',
            mime: item.mime,
            url: item.dataUrl,
            filename: item.filename,
          })),
        );
      }
      await options.opencodeApi.sendPromptAsync(sessionId, {
        directory,
        agent: options.selectedMode.value,
        model: {
          providerID,
          modelID: modelID || '',
        },
        variant: options.selectedThinking.value,
        parts,
      });
      options.sendStatus.value = 'Sent.';
      options.attachments.value = [];
      options.clearComposerDraftForCurrentContext();
    } catch (error) {
      options.sendStatus.value = `Send failed: ${toErrorMessage(error)}`;
    } finally {
      isSending.value = false;
    }
  }

  async function abortSession() {
    if (!options.ensureConnectionReady('Stopping')) return;
    const sessionId = options.selectedSessionId.value;
    if (!sessionId || isAborting.value) return;
    isAborting.value = true;
    options.sendStatus.value = 'Stopping...';
    try {
      const directory = options.activeDirectory.value.trim();
      const busyDescendants = options.busyDescendantSessionIds.value;
      const abortPromises = [
        options.opencodeApi.abortSession(sessionId, directory || undefined),
        ...busyDescendants.map((sid) =>
          options.opencodeApi.abortSession(sid, directory || undefined).catch(() => {}),
        ),
      ];
      await Promise.all(abortPromises);
      options.sendStatus.value = 'Stopped.';
    } catch (error) {
      options.sendStatus.value = `Stop failed: ${toErrorMessage(error)}`;
    } finally {
      isAborting.value = false;
    }
  }

  return {
    sendMessage,
    sendCommand,
    abortSession,
    parseSlashCommand,
    findCommandByName,
    isSending,
    isAborting,
    commandOptions,
    canSend,
    canAbort,
  };
}
