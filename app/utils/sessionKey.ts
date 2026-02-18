export type SessionKey = {
  projectId: string;
  sessionId: string;
};

export function createSessionKey(projectId: string, sessionId: string): string {
  const normalizedProjectId = projectId.trim();
  const normalizedSessionId = sessionId.trim();
  if (!normalizedProjectId || !normalizedSessionId) return '';
  return `${normalizedProjectId}:${normalizedSessionId}`;
}

export function parseSessionKey(key: string): SessionKey | null {
  const separatorIndex = key.indexOf(':');
  if (separatorIndex <= 0) return null;
  const projectId = key.slice(0, separatorIndex).trim();
  const sessionId = key.slice(separatorIndex + 1).trim();
  if (!projectId || !sessionId) return null;
  return {
    projectId,
    sessionId,
  };
}
