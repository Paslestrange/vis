import { computed, ref } from 'vue';
import type { AssistantMessageInfo } from '../types/sse';

export type TokenSnapshot = {
  timestamp: number;
  input: number;
  output: number;
  reasoning: number;
  total: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
};

export type SessionAnalytics = {
  sessionId: string;
  projectId: string;
  snapshots: TokenSnapshot[];
  totalInput: number;
  totalOutput: number;
  totalReasoning: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  estimatedCost: number;
};

export type UsageAggregate = {
  totalInput: number;
  totalOutput: number;
  totalReasoning: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  estimatedCost: number;
  sessionCount: number;
};

const STORAGE_KEY = 'vis:analytics:v1';

const DEFAULT_RATES = {
  input: 5.0,
  output: 15.0,
  cacheRead: 2.5,
  cacheWrite: 2.5,
};

function estimateCost(snapshot: Omit<TokenSnapshot, 'cost' | 'timestamp'>): number {
  return (
    (snapshot.input / 1_000_000) * DEFAULT_RATES.input +
    (snapshot.output / 1_000_000) * DEFAULT_RATES.output +
    (snapshot.cacheRead / 1_000_000) * DEFAULT_RATES.cacheRead +
    (snapshot.cacheWrite / 1_000_000) * DEFAULT_RATES.cacheWrite
  );
}

function loadFromStorage(): Record<string, SessionAnalytics> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, SessionAnalytics>;
      return parsed ?? {};
    }
  } catch {}
  return {};
}

function saveToStorage(data: Record<string, SessionAnalytics>) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function useAnalytics() {
  const sessions = ref<Record<string, SessionAnalytics>>(loadFromStorage());
  const recordedMessageIds = ref<Set<string>>(new Set());

  function recordUsage(sessionId: string, projectId: string, info: AssistantMessageInfo) {
    if (!sessionId) return;
    if (!info.tokens) return;

    const isComplete = info.finish !== undefined || info.time?.completed !== undefined;
    if (!isComplete) return;

    if (recordedMessageIds.value.has(info.id)) return;
    recordedMessageIds.value.add(info.id);

    const input = Number.isFinite(info.tokens.input) ? info.tokens.input : 0;
    const output = Number.isFinite(info.tokens.output) ? info.tokens.output : 0;
    const reasoning = Number.isFinite(info.tokens.reasoning) ? info.tokens.reasoning : 0;
    const cacheRead = Number.isFinite(info.tokens.cache?.read) ? info.tokens.cache!.read : 0;
    const cacheWrite = Number.isFinite(info.tokens.cache?.write) ? info.tokens.cache!.write : 0;
    const total = Number.isFinite(info.tokens.total)
      ? info.tokens.total!
      : input + output + reasoning + cacheRead + cacheWrite;

    const snapshotBase = { input, output, reasoning, total, cacheRead, cacheWrite };
    const cost = estimateCost(snapshotBase);

    const snapshot: TokenSnapshot = {
      timestamp: info.time?.completed ?? info.time?.created ?? Date.now(),
      ...snapshotBase,
      cost,
    };

    const existing = sessions.value[sessionId];
    if (existing) {
      existing.snapshots.push(snapshot);
      existing.totalInput += input;
      existing.totalOutput += output;
      existing.totalReasoning += reasoning;
      existing.totalCacheRead += cacheRead;
      existing.totalCacheWrite += cacheWrite;
      existing.estimatedCost += cost;
    } else {
      sessions.value[sessionId] = {
        sessionId,
        projectId: projectId || '',
        snapshots: [snapshot],
        totalInput: input,
        totalOutput: output,
        totalReasoning: reasoning,
        totalCacheRead: cacheRead,
        totalCacheWrite: cacheWrite,
        estimatedCost: cost,
      };
    }

    sessions.value = { ...sessions.value };
    saveToStorage(sessions.value);
  }

  function getSessionUsage(sessionId: string): SessionAnalytics | undefined {
    return sessions.value[sessionId];
  }

  function getProjectUsage(projectId: string): UsageAggregate {
    return Object.values(sessions.value)
      .filter((s) => s.projectId === projectId)
      .reduce(
        (acc, s) => ({
          totalInput: acc.totalInput + s.totalInput,
          totalOutput: acc.totalOutput + s.totalOutput,
          totalReasoning: acc.totalReasoning + s.totalReasoning,
          totalCacheRead: acc.totalCacheRead + s.totalCacheRead,
          totalCacheWrite: acc.totalCacheWrite + s.totalCacheWrite,
          estimatedCost: acc.estimatedCost + s.estimatedCost,
          sessionCount: acc.sessionCount + 1,
        }),
        {
          totalInput: 0,
          totalOutput: 0,
          totalReasoning: 0,
          totalCacheRead: 0,
          totalCacheWrite: 0,
          estimatedCost: 0,
          sessionCount: 0,
        },
      );
  }

  function getTotalUsage(): UsageAggregate {
    return Object.values(sessions.value).reduce(
      (acc, s) => ({
        totalInput: acc.totalInput + s.totalInput,
        totalOutput: acc.totalOutput + s.totalOutput,
        totalReasoning: acc.totalReasoning + s.totalReasoning,
        totalCacheRead: acc.totalCacheRead + s.totalCacheRead,
        totalCacheWrite: acc.totalCacheWrite + s.totalCacheWrite,
        estimatedCost: acc.estimatedCost + s.estimatedCost,
        sessionCount: acc.sessionCount + 1,
      }),
      {
        totalInput: 0,
        totalOutput: 0,
        totalReasoning: 0,
        totalCacheRead: 0,
        totalCacheWrite: 0,
        estimatedCost: 0,
        sessionCount: 0,
      },
    );
  }

  function resetSession(sessionId: string) {
    if (sessions.value[sessionId]) {
      const { [sessionId]: _, ...rest } = sessions.value;
      sessions.value = rest;
      saveToStorage(sessions.value);
    }
  }

  function resetProject(projectId: string) {
    const next: Record<string, SessionAnalytics> = {};
    for (const [sid, data] of Object.entries(sessions.value)) {
      if (data.projectId !== projectId) {
        next[sid] = data;
      }
    }
    sessions.value = next;
    saveToStorage(sessions.value);
  }

  return {
    sessions: computed(() => sessions.value),
    recordUsage,
    getSessionUsage,
    getProjectUsage,
    getTotalUsage,
    resetSession,
    resetProject,
  };
}
