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

export type PromptQueueItem = {
  id: string;
  sessionId: string;
  directory: string;
  text: string;
  attachments: Attachment[];
  agent: string;
  model: { providerID?: string; modelID: string };
  variant?: string;
  command?: { name: string; args: string; match: CommandInfo } | null;
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
  const promptQueue = ref<PromptQueueItem[]>([]);

  const canSend = computed(() =>
    Boolean(
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

  async function executeSend(item: PromptQueueItem) {
    isSending.value = true;
    options.sendStatus.value = 'Sending...';
    try {
      if (item.command?.match) {
        await options.opencodeApi.sendCommand(item.sessionId, {
          directory: item.directory || undefined,
          command: item.command.match.name,
          arguments: item.command.args,
          agent: item.command.match.agent || item.agent,
          model: item.command.match.model || options.selectedModel.value,
          variant: item.variant,
        });
        options.sendStatus.value = 'Sent.';
      } else {
        const parts = [] as Array<Record<string, unknown>>;
        if (item.text) parts.push({ type: 'text', text: item.text });
        if (item.attachments.length) {
          parts.push(
            ...item.attachments.map((att) => ({
              type: 'file',
              mime: att.mime,
              url: att.dataUrl,
              filename: att.filename,
            })),
          );
        }
        await options.opencodeApi.sendPromptAsync(item.sessionId, {
          directory: item.directory,
          agent: item.agent,
          model: item.model,
          variant: item.variant,
          parts,
        });
        options.sendStatus.value = 'Sent.';
      }
    } catch (error) {
      options.sendStatus.value = `Send failed: ${toErrorMessage(error)}`;
    } finally {
      isSending.value = false;
      void tryDrainQueue(item.sessionId);
    }
  }

  function buildQueueItem(
    sessionId: string,
    directory: string,
    text: string,
    slash: ReturnType<typeof parseSlashCommand>,
    commandMatch: CommandInfo | null,
  ): PromptQueueItem {
    const selectedInfo = options.modelOptions.value.find((model) => model.id === options.selectedModel.value);
    const selectedModelIDs = options.parseProviderModelKey(options.selectedModel.value);
    const providerID = selectedInfo?.providerID ?? (selectedModelIDs.providerID || undefined);
    const modelID = selectedInfo?.modelID ?? (selectedModelIDs.modelID || undefined);
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      sessionId,
      directory,
      text,
      attachments: [...options.attachments.value],
      agent: options.selectedMode.value,
      model: { providerID, modelID: modelID || '' },
      variant: options.selectedThinking.value,
      command: slash && commandMatch ? { name: slash.name, args: slash.arguments ?? '', match: commandMatch } : null,
    };
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

    if (hasText) {
      recentUserInputs.push({ text, time: Date.now() });
      while (recentUserInputs.length > 20) recentUserInputs.shift();
    }

    options.messageInput.value = '';
    options.enableFollow();

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

    const directory = options.requireSelectedWorktree('send');
    if (!directory) return;

    const targetSession = options.filteredSessions.value.find((s) => s.id === sessionId);
    const isTargetBusy = targetSession?.status === 'busy' || targetSession?.status === 'retry';
    const notReady = options.connectionState.value !== 'ready' || options.uiInitState.value !== 'ready';

    if (isTargetBusy || notReady) {
      const item = buildQueueItem(sessionId, directory, text, slash, commandMatch);
      promptQueue.value.push(item);
      options.attachments.value = [];
      const queuedForSession = promptQueue.value.filter((i) => i.sessionId === sessionId).length;
      options.sendStatus.value = queuedForSession > 1 ? `Queued ${queuedForSession} messages` : 'Queued';
      options.clearComposerDraftForCurrentContext();
      return;
    }

    const item = buildQueueItem(sessionId, directory, text, slash, commandMatch);
    options.attachments.value = [];
    options.clearComposerDraftForCurrentContext();
    await executeSend(item);
  }

  async function tryDrainQueue(targetSessionId?: string) {
    if (isSending.value) return;
    if (options.uiInitState.value !== 'ready' || options.connectionState.value !== 'ready') return;

    const queue = promptQueue.value;
    if (queue.length === 0) return;

    const sessionId = targetSessionId ?? options.selectedSessionId.value;
    if (!sessionId) return;

    const session = options.filteredSessions.value.find((s) => s.id === sessionId);
    const isBusy = session?.status === 'busy' || session?.status === 'retry';
    if (isBusy) return;

    const next = queue.find((item) => item.sessionId === sessionId);
    if (!next) return;

    promptQueue.value = queue.filter((item) => item.id !== next.id);
    await executeSend(next);
  }

  function cancelQueuedPrompt(id: string) {
    promptQueue.value = promptQueue.value.filter((item) => item.id !== id);
  }

  function clearQueueForSession(sessionId: string) {
    promptQueue.value = promptQueue.value.filter((item) => item.sessionId !== sessionId);
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
    promptQueue,
    cancelQueuedPrompt,
    clearQueueForSession,
    tryDrainQueue,
  };
}
