import {
  StorageKeys,
  storageGet,
  storageSet,
  storageSetJSON,
} from '../utils/storageKeys';

export type Attachment = {
  id: string;
  filename: string;
  mime: string;
  dataUrl: string;
};

export type ComposerDraft = {
  messageInput: string;
  attachments: Attachment[];
  agent: string;
  model: string;
  variant?: string;
  updatedAt: number;
  rev: number;
  writerTabId: string;
};

function normalizeStoredAttachment(value: unknown): Attachment | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const filename = typeof record.filename === 'string' ? record.filename.trim() : '';
  const mime = typeof record.mime === 'string' ? record.mime.trim() : '';
  const dataUrl = typeof record.dataUrl === 'string' ? record.dataUrl : '';
  if (!id || !filename || !mime || !dataUrl) return null;
  return { id, filename, mime, dataUrl };
}

function normalizeStoredComposerDraft(value: unknown): ComposerDraft | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const messageInput = typeof record.messageInput === 'string' ? record.messageInput : '';
  const attachments = Array.isArray(record.attachments)
    ? record.attachments
        .map((item) => normalizeStoredAttachment(item))
        .filter((item): item is Attachment => Boolean(item))
    : [];
  const agent = typeof record.agent === 'string' ? record.agent : '';
  const model = typeof record.model === 'string' ? record.model : '';
  const variant = typeof record.variant === 'string' ? record.variant : undefined;
  const updatedAt = typeof record.updatedAt === 'number' ? record.updatedAt : Date.now();
  const rev = typeof record.rev === 'number' ? record.rev : updatedAt;
  const writerTabId = typeof record.writerTabId === 'string' ? record.writerTabId : '';
  return {
    messageInput,
    attachments,
    agent,
    model,
    variant,
    updatedAt,
    rev,
    writerTabId,
  };
}

function parseComposerDraftStore(raw: string | null) {
  if (!raw) return {} as Record<string, ComposerDraft>;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {} as Record<string, ComposerDraft>;
    const normalized: Record<string, ComposerDraft> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      const draft = normalizeStoredComposerDraft(value);
      if (!draft) return;
      normalized[key] = draft;
    });
    return normalized;
  } catch {
    return {} as Record<string, ComposerDraft>;
  }
}

function readComposerDraftStore() {
  const raw = storageGet(StorageKeys.drafts.composer);
  return parseComposerDraftStore(raw);
}

function writeComposerDraftStore(store: Record<string, ComposerDraft>) {
  storageSetJSON(StorageKeys.drafts.composer, store);
}

export function useComposerDrafts() {
  const revisionByContext = new Map<string, number>();

  function readComposerDraft(contextKey: string) {
    if (!contextKey) return null;
    const store = readComposerDraftStore();
    return store[contextKey] ?? null;
  }

  function nextComposerDraftRevision(contextKey: string, existingDraft?: ComposerDraft | null) {
    const storeRev = existingDraft?.rev ?? 0;
    const knownRev = revisionByContext.get(contextKey) ?? 0;
    const nextRev = Math.max(storeRev, knownRev) + 1;
    revisionByContext.set(contextKey, nextRev);
    return nextRev;
  }

  function writeComposerDraft(contextKey: string, draft: ComposerDraft) {
    if (!contextKey) return;
    const store = readComposerDraftStore();
    store[contextKey] = draft;
    revisionByContext.set(contextKey, draft.rev);
    writeComposerDraftStore(store);
  }

  function parseComposerDraftStoreRaw(raw: string | null) {
    return parseComposerDraftStore(raw);
  }

  function trackRevision(contextKey: string, rev: number) {
    revisionByContext.set(contextKey, rev);
  }

  function deleteRevision(contextKey: string) {
    revisionByContext.delete(contextKey);
  }

  function getRevision(contextKey: string) {
    return revisionByContext.get(contextKey) ?? 0;
  }

  return {
    readComposerDraft,
    nextComposerDraftRevision,
    writeComposerDraft,
    parseComposerDraftStoreRaw,
    readComposerDraftStore,
    writeComposerDraftStore,
    trackRevision,
    deleteRevision,
    getRevision,
  };
}
