import { computed, nextTick, ref, type Ref } from 'vue';
import {
  useComposerDrafts,
  type Attachment,
  type ComposerDraft,
} from './useComposerDrafts';
import { toErrorMessage } from '../utils/formatters';
import type { ThemeJson, ThemeColors } from '../utils/theme';
import type { useMessages } from './useMessages';
import type { UserMessageMeta } from './useMessageMeta';
import { StorageKeys, storageKey } from '../utils/storageKeys';

export type ComposerStateModelOption = {
  id: string;
  modelID: string;
  label: string;
  displayName: string;
  providerID?: string;
  providerLabel?: string;
  variants?: Record<string, unknown>;
  attachmentCapable?: boolean;
};

export type ComposerStateAgentOption = {
  id: string;
  label: string;
  description?: string;
  color?: string;
};

export type ComposerStateAgentInfo = {
  name: string;
  hidden?: boolean;
  color?: string;
};

export type ComposerStateOptions = {
  selectedSessionId: Ref<string>;
  selectedModel: Ref<string>;
  selectedThinking: Ref<string | undefined>;
  selectedMode: Ref<string>;
  modelOptions: Ref<ComposerStateModelOption[]>;
  agentOptions: Ref<ComposerStateAgentOption[]>;
  thinkingOptions: Ref<Array<string | undefined>>;
  agents: Ref<ComposerStateAgentInfo[]>;
  applyAgentDefaults: (agentName: string) => void;
  applyModelVariantSelection: (model: string | undefined, variant: string | undefined) => void;
  resolveDefaultAgentModel: () => { agent: string; model: string; variant: string | undefined };
  composerDrafts: ReturnType<typeof useComposerDrafts>;
  msg: ReturnType<typeof useMessages>;
  sendStatus: Ref<string>;
  attachmentMimeAllowlist: Set<string> | string[];
  resolvedTheme?: Ref<ThemeColors>;
  opencodeTheme?: ThemeJson;
  resolveTheme?: (themeJson: ThemeJson, mode: 'dark' | 'light') => ThemeColors;
  resolveAgentColor: (
    agentName: string,
    agentColor: string | undefined | null,
    visibleAgents: Array<{ name: string; color?: string }>,
    theme: ThemeColors,
  ) => string;
  storageKey: typeof storageKey;
  StorageKeys: typeof StorageKeys;
  userMessageMetaById: Ref<Record<string, UserMessageMeta>>;
};

export function useComposerState(options: ComposerStateOptions) {
  const composerDraftTabId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const messageInput = ref('');
  const attachments = ref<Attachment[]>([]);

  const resolvedTheme = computed<ThemeColors>(() => {
    if (options.resolvedTheme) {
      return options.resolvedTheme.value;
    }
    if (options.opencodeTheme && options.resolveTheme) {
      return options.resolveTheme(options.opencodeTheme, 'dark');
    }
    throw new Error('useComposerState requires either resolvedTheme or opencodeTheme + resolveTheme');
  });

  function clearComposerInputState() {
    messageInput.value = '';
    attachments.value = [];
  }

  function draftKeyForSelectedContext() {
    return options.selectedSessionId.value;
  }

  function applyComposerDraftToComposerState(draft: ComposerDraft, contextKey: string) {
    options.composerDrafts.trackRevision(contextKey, draft.rev);
    messageInput.value = draft.messageInput;
    attachments.value = draft.attachments.slice();

    // Bootstrap guard: if options not loaded yet, apply draft values as-is
    if (options.agentOptions.value.length === 0 || options.modelOptions.value.length === 0) {
      if (draft.agent) options.selectedMode.value = draft.agent;
      if (draft.model) options.selectedModel.value = draft.model;
      options.selectedThinking.value = draft.variant;
      return;
    }

    // Validate and apply agent
    let agentToApply = draft.agent;
    if (draft.agent && !options.agentOptions.value.some((o) => o.id === draft.agent)) {
      // Agent not found, fall back to defaults
      const defaults = options.resolveDefaultAgentModel();
      agentToApply = defaults.agent;
    } else if (draft.agent) {
      agentToApply = draft.agent;
      options.selectedMode.value = agentToApply;
    }

    // Apply agent defaults to get correct model and variant
    if (agentToApply) {
      options.selectedMode.value = agentToApply;
      options.applyAgentDefaults(agentToApply);
    }

    const modelToApply =
      draft.model && options.modelOptions.value.some((model) => model.id === draft.model)
        ? draft.model
        : undefined;
    options.applyModelVariantSelection(modelToApply, draft.variant);
  }

  function restoreComposerDraftForContext(contextKey: string): boolean {
    if (!contextKey) return false;
    const draft = options.composerDrafts.readComposerDraft(contextKey);
    if (!draft) return false;
    applyComposerDraftToComposerState(draft, contextKey);
    return true;
  }

  function persistComposerDraftForCurrentContext() {
    const contextKey = draftKeyForSelectedContext();
    if (!contextKey) return;
    const existingDraft = options.composerDrafts.readComposerDraft(contextKey);
    const rev = options.composerDrafts.nextComposerDraftRevision(contextKey, existingDraft);
    const draft: ComposerDraft = {
      messageInput: messageInput.value,
      attachments: attachments.value.map((item) => ({
        id: item.id,
        filename: item.filename,
        mime: item.mime,
        dataUrl: item.dataUrl,
      })),
      agent: options.selectedMode.value,
      model: options.selectedModel.value,
      variant: options.selectedThinking.value,
      updatedAt: Date.now(),
      rev,
      writerTabId: composerDraftTabId,
    };
    options.composerDrafts.writeComposerDraft(contextKey, draft);
  }

  function clearComposerDraftForCurrentContext() {
    messageInput.value = '';
    attachments.value = [];
    persistComposerDraftForCurrentContext();
  }

  function handleMessageInputUpdate(value: string) {
    messageInput.value = value;
    persistComposerDraftForCurrentContext();
  }

  function handleSelectedModeUpdate(value: string) {
    options.selectedMode.value = value;
    options.applyAgentDefaults(value);
    persistComposerDraftForCurrentContext();
  }

  function handleApplyHistoryEntry(entry: {
    text: string;
    agent?: string;
    model?: string;
    variant?: string;
  }) {
    messageInput.value = entry.text;
    if (entry.agent && options.agentOptions.value.some((option) => option.id === entry.agent)) {
      options.selectedMode.value = entry.agent;
      options.applyAgentDefaults(entry.agent);
    }
    options.applyModelVariantSelection(entry.model, entry.variant);
    persistComposerDraftForCurrentContext();
  }

  function handleSelectedModelUpdate(value: string) {
    options.selectedModel.value = value;
    nextTick(() => {
      persistComposerDraftForCurrentContext();
    });
  }

  function handleSelectedThinkingUpdate(value: string | undefined) {
    options.selectedThinking.value = value;
    persistComposerDraftForCurrentContext();
  }

  function handleComposerDraftStorage(event: StorageEvent) {
    if (event.storageArea !== window.localStorage) return;
    if (event.key !== options.storageKey(options.StorageKeys.drafts.composer)) return;
    const contextKey = draftKeyForSelectedContext();
    if (!contextKey) return;
    const store = options.composerDrafts.parseComposerDraftStoreRaw(event.newValue);
    const draft = store[contextKey] ?? null;
    const knownRev = options.composerDrafts.getRevision(contextKey);
    if (!draft) {
      options.composerDrafts.deleteRevision(contextKey);
      clearComposerInputState();
      return;
    }
    if (draft.rev < knownRev) return;
    applyComposerDraftToComposerState(draft, contextKey);
  }

  function buildComposerDraftFromUserMessage(payload: {
    sessionId: string;
    messageId: string;
  }): Omit<ComposerDraft, 'rev' | 'writerTabId'> {
    const message = options.msg.get(payload.messageId);
    const messageInput = (message ? options.msg.getTextContent(payload.messageId) : '') || '';
    const sourceAttachments =
      (message ? options.msg.getImageAttachments(payload.messageId) : undefined) ?? [];
    const attachmentsForDraft: Attachment[] = sourceAttachments.map((item) => ({
      id: item.id,
      filename: item.filename,
      mime: item.mime,
      dataUrl: item.url,
    }));
    const meta = options.userMessageMetaById.value[payload.messageId];
    return {
      messageInput,
      attachments: attachmentsForDraft,
      agent: meta?.agent ?? '',
      model: meta?.modelId ?? '',
      variant: meta?.variant,
      updatedAt: Date.now(),
    };
  }

  function generateAttachmentId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `att-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('File read failed.'));
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') resolve(result);
        else reject(new Error('File read failed.'));
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleAddAttachments(files: File[]) {
    const allowlist = options.attachmentMimeAllowlist;
    const isAccepted = (mime: string) =>
      allowlist instanceof Set ? allowlist.has(mime) : allowlist.includes(mime);
    const accepted = files.filter((file) => isAccepted(file.type));
    if (accepted.length === 0) {
      options.sendStatus.value = 'Unsupported attachment type.';
      return;
    }
    try {
      const next = await Promise.all(
        accepted.map(async (file) => ({
          id: generateAttachmentId(),
          filename: file.name || 'image',
          mime: file.type || 'application/octet-stream',
          dataUrl: await readFileAsDataUrl(file),
        })),
      );
      attachments.value = [...attachments.value, ...next];
      persistComposerDraftForCurrentContext();
    } catch (error) {
      options.sendStatus.value = `Attachment failed: ${toErrorMessage(error)}`;
    }
  }

  function removeAttachment(id: string) {
    attachments.value = attachments.value.filter((item) => item.id !== id);
    persistComposerDraftForCurrentContext();
  }

  const hasAgentOptions = computed(() => options.agentOptions.value.length > 0);
  const hasModelOptions = computed(() => options.modelOptions.value.length > 0);
  const hasThinkingOptions = computed(() => options.thinkingOptions.value.length > 0);
  const canAttach = computed(() => {
    const selected = options.modelOptions.value.find((m) => m.id === options.selectedModel.value);
    return selected?.attachmentCapable !== false;
  });

  const visibleAgents = computed(() => options.agents.value.filter((a) => !a.hidden));

  function resolveAgentColorForName(agentName?: string) {
    const agent = agentName ? options.agents.value.find((a) => a.name === agentName) : undefined;
    return options.resolveAgentColor(
      agentName ?? '',
      agent?.color,
      visibleAgents.value,
      resolvedTheme.value,
    );
  }

  function resolveModelMetaForPath(modelPath?: string) {
    if (!modelPath) return undefined;
    const matched = options.modelOptions.value.find((model) => model.id === modelPath);
    if (!matched) return undefined;
    return {
      displayName: matched.displayName,
      providerLabel: matched.providerLabel,
    };
  }

  const currentAgentColor = computed(() => resolveAgentColorForName(options.selectedMode.value));

  return {
    messageInput,
    attachments,
    handleMessageInputUpdate,
    persistComposerDraftForCurrentContext,
    clearComposerDraftForCurrentContext,
    restoreComposerDraftForContext,
    handleComposerDraftStorage,
    buildComposerDraftFromUserMessage,
    handleSelectedModeUpdate,
    handleSelectedModelUpdate,
    handleSelectedThinkingUpdate,
    handleApplyHistoryEntry,
    handleAddAttachments,
    removeAttachment,
    generateAttachmentId,
    readFileAsDataUrl,
    hasAgentOptions,
    hasModelOptions,
    hasThinkingOptions,
    canAttach,
    visibleAgents,
    resolveAgentColorForName,
    resolveModelMetaForPath,
    currentAgentColor,
  };
}
