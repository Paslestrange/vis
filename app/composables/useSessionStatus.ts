import { ref } from 'vue';
import type { Ref, ComputedRef } from 'vue';

export function useSessionStatus(options: {
  selectedSessionId: Ref<string>;
  allowedSessionIds: ComputedRef<Set<string>>;
  updateReasoningExpiry: (sessionId: string, state: 'busy' | 'idle') => void;
}) {
  const { selectedSessionId, allowedSessionIds, updateReasoningExpiry } = options;

  const retryStatus = ref<{ message: string; next: number; attempt: number } | null>(null);

  function formatRetryTime(timestamp: number): string {
    const nextDate = new Date(timestamp);
    const now = Date.now();
    const diffMs = timestamp - now;

    const absolute = nextDate
      .toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      .replace(/(\d+)\/(\d+)\/(\d+),/, '$3/$1/$2');

    const diffSec = Math.max(0, Math.ceil(diffMs / 1000));
    const diffMin = Math.ceil(diffSec / 60);
    const diffHour = Math.ceil(diffMin / 60);

    let relative: string;
    if (diffHour > 1) {
      relative = `in ${diffHour} hours`;
    } else if (diffMin > 1) {
      relative = `in ${diffMin} minutes`;
    } else {
      relative = `in ${diffSec} seconds`;
    }

    return `${absolute} (${relative})`;
  }

  function applySessionStatusEvent(
    sessionId: string,
    status: { type: 'busy' | 'idle' | 'retry'; message?: string; next?: number; attempt?: number },
  ) {
    const isAllowedSession = allowedSessionIds.value.has(sessionId);
    const isSelectedSession = sessionId === selectedSessionId.value;

    if (status.type === 'busy' || status.type === 'idle') {
      if (isAllowedSession) {
        if (isSelectedSession) retryStatus.value = null;
        updateReasoningExpiry(sessionId, status.type);
      }
      return;
    }

    if (status.type !== 'retry') return;
    if (!isSelectedSession || !isAllowedSession) return;

    updateReasoningExpiry(sessionId, 'busy');
    if (status.message && typeof status.next === 'number') {
      retryStatus.value = {
        message: status.message,
        next: status.next,
        attempt: status.attempt || 1,
      };
    }
  }

  return {
    retryStatus,
    formatRetryTime,
    applySessionStatusEvent,
  };
}
