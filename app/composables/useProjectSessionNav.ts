import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { resolveProjectColorHex } from '../utils/stateBuilder';
import { toErrorMessage } from '../utils/formatters';
import { decodeApiTextContent, type FileContentResponse } from './useToolWindows';
import type { TodoItem } from './useTodos';
import type { ProjectState, WorkerNotificationEntry } from '../types/worker-state';

export type LocalSessionInfo = {
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

type WorktreeInfo = {
  name: string;
  branch: string;
  directory: string;
};

type TodoPanelSession = {
  sessionId: string;
  title: string;
  isSubagent: boolean;
  todos: TodoItem[];
  loading: boolean;
  error: string | undefined;
};

type QuerySelection = {
  projectId: string;
  sessionId: string;
};

type TopPanelSession = {
  id: string;
  title?: string;
  slug?: string;
  status: 'busy' | 'idle' | 'retry' | 'unknown';
  timeCreated?: number;
  timeUpdated?: number;
  archivedAt?: number;
};

type TopPanelSandbox = {
  directory: string;
  branch?: string;
  sessions: TopPanelSession[];
};

type TopPanelWorktree = {
  directory: string;
  label: string;
  name?: string;
  projectId?: string;
  projectColor?: string;
  sandboxes: TopPanelSandbox[];
};

type TopPanelNotificationSession = {
  projectId: string;
  sessionId: string;
  count: number;
};

export interface UseProjectSessionNavOptions {
  serverState: {
    projects: Record<string, ProjectState>;
    notifications: Record<string, WorkerNotificationEntry>;
    bootstrapped: Ref<boolean>;
  };
  openCodeApi: {
    createSession: (directory: string) => Promise<LocalSessionInfo & { projectID: string }>;
    createWorktree: (payload: { directory: string; projectId: string }) => Promise<WorktreeInfo>;
    deleteWorktree: (payload: {
      directory: string;
      targetDirectory: string;
      projectId: string;
    }) => Promise<void>;
    openProject: (directory: string) => Promise<{ projectId: string; sessionId: string }>;
    updateProject: (projectId: string, data: Record<string, unknown>) => Promise<void>;
    readFileContent: (payload: {
      directory: string;
      path: string;
    }) => Promise<FileContentResponse | string>;
  };
  sessionSelection: {
    selectedProjectId: Ref<string>;
    selectedSessionId: Ref<string>;
    projectDirectory: Ref<string>;
    activeDirectory: Ref<string>;
    switchSession: (projectId: string, sessionId: string) => Promise<void>;
    initialize: () => Promise<void>;
  };
  homePath: Ref<string>;
  sendStatus: Ref<string>;
  ensureConnectionReady: (action: string) => boolean;
  fetchCommands: (directory: string) => Promise<void> | void;
  bootstrapReady: Ref<boolean>;
  fw: {
    closeAll: (options?: { exclude?: (key: string) => boolean }) => void;
  };
  ge: {
    sendToWorker: (message: Record<string, unknown>) => void;
  };
  msg: {
    reset: () => void;
    roots: Ref<unknown[]>;
  };
  reasoning: {
    reset: () => void;
  };
  subagentWindows: {
    reset: () => void;
  };
  shellManager: {
    restoreShellSessions: () => Promise<void> | void;
  };
  retryStatus: Ref<{ message: string; next: number; attempt: number } | null>;
  todosBySessionId: Ref<Record<string, TodoItem[]>>;
  todoLoadingBySessionId: Ref<Record<string, boolean>>;
  todoErrorBySessionId: Ref<Record<string, string>>;
  focusInput: () => void;
  fetchPendingPermissions: (directory?: string) => Promise<void> | void;
  fetchPendingQuestions: (directory?: string) => Promise<void> | void;
  allowedSessionIds: ComputedRef<Set<string>>;
  sessions: ComputedRef<LocalSessionInfo[]>;
  sessionParentById: ComputedRef<Map<string, string | undefined>>;
  sessionLabel: (session: { id: string; title?: string; slug?: string }) => string;
  isBootstrapping: Ref<boolean>;
  uiInitState: Ref<'loading' | 'ready' | 'error' | 'login'>;
  messageMeta: {
    fetchHistory: (sessionId: string) => Promise<void>;
    loadCachedHistory: (sessionId: string) => boolean;
    getCachedHistory: (sessionId: string) => Array<Record<string, unknown>> | undefined;
  };
  resetFollow: () => void;
  scrollOutputPanelToBottom: (smooth?: boolean) => void;
  reloadTodosForAllowedSessions: () => Promise<void> | void;
  sessionError: Ref<string>;
  notificationSessionOrder?: Ref<string[]>;
}

export function useProjectSessionNav(options: UseProjectSessionNavOptions) {
  const { serverState, openCodeApi, sessionSelection, homePath } = options;

  function getProjectSessions(projectId: string): LocalSessionInfo[] {
    const project = serverState.projects[projectId];
    if (!project) return [];
    const list: LocalSessionInfo[] = [];
    Object.values(project.sandboxes).forEach((sandbox: any) => {
      Object.values(sandbox.sessions).forEach((session: any) => {
        list.push({
          id: session.id,
          parentID: session.parentID,
          title: session.title,
          slug: session.slug,
          directory: sandbox.directory,
          status: session.status,
          time: { created: session.timeCreated, updated: session.timeUpdated, archived: session.timeArchived },
          revert: session.revert,
        });
      });
    });
    return list;
  }

  function normalizeDirectory(value: string) {
    const trimmed = value.replace(/\/+$/, '');
    return trimmed || value;
  }

  function replaceHomePrefix(path: string) {
    const normalizedPath = normalizeDirectory(path);
    const normalizedHome = normalizeDirectory(homePath.value);
    if (!normalizedHome || !normalizedPath.startsWith('/')) return normalizedPath;
    if (normalizedPath === normalizedHome) return '~';
    const prefix = `${normalizedHome}/`;
    if (normalizedPath.startsWith(prefix)) {
      return `~/${normalizedPath.slice(prefix.length)}`;
    }
    return normalizedPath;
  }

  const editingProject = ref<{ projectId: string; worktree: string } | null>(null);
  const projectError = ref('');
  const worktreeError = ref('');
  const notificationSessionOrder = options.notificationSessionOrder ?? ref<string[]>([]);

  const initialQuery = readQuerySelection();

  const currentProjectColor = computed(() => {
    const project = serverState.projects[sessionSelection.selectedProjectId.value];
    return resolveProjectColorHex(project?.icon?.color);
  });

  const currentProjectName = computed(() => {
    const project = serverState.projects[sessionSelection.selectedProjectId.value];
    if (!project) return undefined;
    const name = project.name?.trim();
    if (name) return name;
    return project.worktree?.replace(/\/+$/, '').split('/').pop() || undefined;
  });

  const editingProjectMeta = computed(() => {
    const pid = editingProject.value?.projectId;
    return pid ? serverState.projects[pid] : undefined;
  });

  const topPanelTreeData = computed<TopPanelWorktree[]>(() => {
    const entries = Object.values(serverState.projects)
      .map((project) => {
        const worktreeDirectory = project.worktree;
        const sandboxEntries = Object.values(project.sandboxes)
          .map((sandbox) => {
            const rootSessionsList = sandbox.rootSessions
              .map((sessionId) => sandbox.sessions[sessionId])
              .filter((session): session is NonNullable<typeof session> => Boolean(session));
            const sessionsForSandbox = (rootSessionsList.length > 0
              ? rootSessionsList
              : Object.values(sandbox.sessions).filter((session): session is NonNullable<typeof session> => Boolean(session))
            )
              .map((session) => ({
                id: session.id,
                title: session.title,
                slug: session.slug,
                status: (session.status ?? 'unknown') as 'busy' | 'idle' | 'retry' | 'unknown',
                timeCreated: session.timeCreated,
                timeUpdated: session.timeUpdated ?? session.timeCreated,
                archivedAt: session.timeArchived,
              }))
              .sort((a, b) => (b.timeCreated ?? 0) - (a.timeCreated ?? 0));
            const latestUpdated = sessionsForSandbox[0]?.timeUpdated ?? 0;
            const oldestCreated =
              sessionsForSandbox.length > 0
                ? Math.min(
                    ...sessionsForSandbox.map((session) => session.timeUpdated ?? Infinity),
                  )
                : 0;
            return {
              directory: sandbox.directory,
              branch: sandbox.name || undefined,
              sessions: sessionsForSandbox,
              latestUpdated,
              oldestCreated,
            };
          })
          .sort((a, b) => {
            const aIsPrimary = a.directory === worktreeDirectory;
            const bIsPrimary = b.directory === worktreeDirectory;
            if (aIsPrimary !== bIsPrimary) return aIsPrimary ? -1 : 1;
            return (b.oldestCreated || 0) - (a.oldestCreated || 0);
          });
        const latestSandboxUpdated = sandboxEntries
          .flatMap((sandbox) => sandbox.sessions)
          .reduce((max, session) => Math.max(max, session.timeUpdated ?? 0), 0);
        const name =
          project.name?.trim() ||
          worktreeDirectory.replace(/\/+$/, '').split('/').pop() ||
          undefined;
        return {
          directory: worktreeDirectory,
          label: replaceHomePrefix(worktreeDirectory),
          name,
          projectId: project.id,
          projectColor: resolveProjectColorHex(project.icon?.color),
          sandboxes: sandboxEntries,
          latestUpdated: latestSandboxUpdated,
        };
      })
      .sort((a, b) => {
        if (a.directory === '/' && b.directory !== '/') return 1;
        if (b.directory === '/' && a.directory !== '/') return -1;
        return (a.name || a.label).localeCompare(b.name || b.label);
      });
    return entries;
  });

  const navigableTree = computed(() => {
    return topPanelTreeData.value
      .map((worktree) => ({
        ...worktree,
        sandboxes: worktree.sandboxes
          .map((sandbox) => ({
            ...sandbox,
            sessions: sandbox.sessions.filter((s) => !s.archivedAt),
          }))
          .filter(
            (sandbox) => worktree.projectId !== 'global' || sandbox.sessions.length > 0,
          ),
      }))
      .filter((worktree) =>
        worktree.sandboxes.some((sandbox) => sandbox.sessions.length > 0),
      );
  });

  const notificationSessions = computed<TopPanelNotificationSession[]>(() =>
    notificationSessionOrder.value
      .map((key) => {
        const entry = serverState.notifications[key];
        if (!entry) return null;
        return {
          projectId: entry.projectId,
          sessionId: entry.sessionId,
          count: entry.requestIds.length,
        };
      })
      .filter((item): item is TopPanelNotificationSession => Boolean(item))
      .filter((item) => item.count > 0),
  );

  const todoPanelSessions = computed(() => {
    const allowed = options.allowedSessionIds.value;
    if (allowed.size === 0) return [] as TodoPanelSession[];
    const sessionById = new Map(options.sessions.value.map((s) => [s.id, s]));
    const list = Array.from(allowed).map((sessionId) => {
      const session = sessionById.get(sessionId);
      const title = options.sessionLabel(session ?? { id: sessionId });
      const isSubagent = Boolean(options.sessionParentById.value.get(sessionId));
      return {
        sessionId,
        title,
        isSubagent,
        todos: options.todosBySessionId.value[sessionId] ?? [],
        loading: Boolean(options.todoLoadingBySessionId.value[sessionId]),
        error: options.todoErrorBySessionId.value[sessionId],
      };
    });
    const visible = list.filter((entry) => entry.todos.length > 0 || Boolean(entry.error));
    if (visible.length === 0) return [] as TodoPanelSession[];
    visible.sort((a, b) => {
      if (a.sessionId === sessionSelection.selectedSessionId.value) return -1;
      if (b.sessionId === sessionSelection.selectedSessionId.value) return 1;
      if (a.isSubagent !== b.isSubagent) return a.isSubagent ? 1 : -1;
      return a.title.localeCompare(b.title);
    });
    return visible;
  });

  watch(
    () => serverState.notifications,
    (notifications) => {
      const keys = Object.keys(notifications);
      const keep = notificationSessionOrder.value.filter((key) => keys.includes(key));
      const next = keys.filter((key) => !keep.includes(key));
      notificationSessionOrder.value = [...keep, ...next];
    },
    { immediate: true, deep: true },
  );

  function sessionSortKey(session: LocalSessionInfo) {
    return session.time?.updated ?? session.time?.created ?? 0;
  }

  function pickPreferredSessionId(list: LocalSessionInfo[]) {
    if (!Array.isArray(list) || list.length === 0) return '';
    const sorted = list
      .filter((session) => !session.parentID && !session.time?.archived)
      .slice()
      .sort((a, b) => sessionSortKey(b) - sessionSortKey(a));
    return sorted[0]?.id ?? '';
  }

  function validateSelectedSession() {
    const sessionId = sessionSelection.selectedSessionId.value.trim();
    if (!sessionId) return;

    const projectId = sessionSelection.selectedProjectId.value.trim();
    const allSessions = projectId ? getProjectSessions(projectId) : [];
    const current = allSessions.find((session) => session.id === sessionId);
    if (current && !current.parentID) {
      return;
    }

    const nextSessionId = pickPreferredSessionId(
      allSessions.filter((session) => session.id !== sessionId),
    );
    sessionSelection.selectedSessionId.value = nextSessionId;
  }

  function resolveProjectIdForDirectory(directory?: string) {
    const normalized = directory?.trim() || '';
    if (!normalized) return '';
    for (const [projectId, project] of Object.entries(serverState.projects)) {
      if (project.worktree === normalized) return projectId;
      if (project.sandboxes[normalized]) return projectId;
    }
    return '';
  }

  function readQuerySelection(): QuerySelection {
    if (typeof window === 'undefined') return { projectId: '', sessionId: '' };
    const params = new URLSearchParams(window.location.search);
    return {
      projectId: params.get('project')?.trim() ?? '',
      sessionId: params.get('session')?.trim() ?? '',
    };
  }

  function replaceQuerySelection(projectId: string, sessionId: string) {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const nextProject = projectId.trim();
    const nextSession = sessionId.trim();
    const params = url.searchParams;
    const currentProject = params.get('project') ?? '';
    const currentSession = params.get('session') ?? '';
    const hasLegacyWorktree = params.has('worktree');
    const sameSelection =
      currentProject === nextProject && currentSession === nextSession && !hasLegacyWorktree;
    if (sameSelection) return;
    if (nextProject) params.set('project', nextProject);
    else params.delete('project');
    if (nextSession) params.set('session', nextSession);
    else params.delete('session');
    params.delete('worktree');
    url.search = params.toString();
    window.history.replaceState({}, '', url.toString());
  }

  async function initProjectNameFromPackageJson(projectId: string, directory: string) {
    try {
      const result = (await openCodeApi.readFileContent({
        directory,
        path: 'package.json',
      })) as FileContentResponse | string;
      const content = typeof result === 'string' ? result : result?.content;
      if (!content) return;
      const isBase64 = typeof result !== 'string' && result?.encoding === 'base64';
      const decoded =
        typeof content === 'string' && isBase64
          ? decodeApiTextContent(result as FileContentResponse)
          : content;
      const parsed = JSON.parse(decoded);
      const name = parsed?.name;
      if (typeof name !== 'string' || !name.trim()) return;
      await openCodeApi.updateProject(projectId, { directory, name: name.trim() });
    } catch {
      // Silently ignore - package.json may not exist or be invalid
    }
  }

  async function createSessionInDirectory(directory: string) {
    const session = await openCodeApi.createSession(directory);
    if (!session?.id) return undefined;
    await sessionSelection.switchSession(session.projectID, session.id);
    return session;
  }

  async function createNewSession(): Promise<LocalSessionInfo | undefined> {
    if (!options.ensureConnectionReady('Creating session')) return undefined;
    options.sessionError.value = '';
    try {
      const directory = sessionSelection.activeDirectory.value.trim();
      if (!directory) {
        throw new Error('Session create failed: active directory is empty.');
      }
      const data = await openCodeApi.createSession(directory);
      if (data && typeof data.id === 'string') {
        const nextProjectId = data.projectID;
        await sessionSelection.switchSession(nextProjectId, data.id);
      }
      return data;
    } catch (error) {
      options.sessionError.value = `Session create failed: ${toErrorMessage(error)}`;
      return undefined;
    }
  }

  async function createWorktreeFromWorktree(worktree: string) {
    if (!options.ensureConnectionReady('Creating worktree')) return;
    worktreeError.value = '';
    if (!worktree) {
      worktreeError.value = 'Worktree base directory not set.';
      return;
    }
    try {
      const data = (await openCodeApi.createWorktree({
        directory: worktree,
        projectId: sessionSelection.selectedProjectId.value,
      })) as WorktreeInfo;
      if (data && typeof data.directory === 'string') {
        await createSessionInDirectory(data.directory);
      }
    } catch (error) {
      worktreeError.value = `Worktree create failed: ${toErrorMessage(error)}`;
    }
  }

  async function deleteWorktree(directory: string) {
    if (!options.ensureConnectionReady('Deleting worktree')) return;
    worktreeError.value = '';
    if (!directory) return;
    if (!sessionSelection.projectDirectory.value) {
      worktreeError.value = 'Worktree base directory not set.';
      return;
    }
    const baseDir = sessionSelection.projectDirectory.value.replace(/\/+$/, '');
    const targetDir = directory.replace(/\/+$/, '');
    if (baseDir && targetDir === baseDir) return;
    try {
      await openCodeApi.deleteWorktree({
        directory: sessionSelection.projectDirectory.value,
        targetDirectory: targetDir,
        projectId: sessionSelection.selectedProjectId.value,
      });
      if (normalizeDirectory(sessionSelection.activeDirectory.value) === targetDir) {
        const projectId = sessionSelection.selectedProjectId.value.trim();
        const candidates = getProjectSessions(projectId).filter(
          (session) => {
            if (session.parentID || session.time?.archived) return false;
            const sessionDirectory = normalizeDirectory(
              session.directory || sessionSelection.projectDirectory.value,
            );
            return sessionDirectory !== targetDir;
          },
        );
        const nextSessionId = pickPreferredSessionId(candidates);
        if (projectId && nextSessionId) {
          sessionSelection.selectedProjectId.value = projectId;
          sessionSelection.selectedSessionId.value = nextSessionId;
        } else {
          await createSessionInDirectory(baseDir);
        }
      }
    } catch (error) {
      worktreeError.value = `Worktree delete failed: ${toErrorMessage(error)}`;
    }
  }

  function openProjectPicker() {}

  function handleEditProject(payload: { projectId: string; worktree: string }) {
    editingProject.value = payload;
  }

  async function handleSaveProject(payload: {
    projectId: string;
    worktree: string;
    name: string;
    icon: { color: string; override: string };
    commands: { start: string };
  }) {
    try {
      await openCodeApi.updateProject(payload.projectId, {
        directory: payload.worktree,
        name: payload.name,
        icon: payload.icon,
        commands: payload.commands,
      });
      editingProject.value = null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update project:', error);
    }
  }

  async function handleProjectDirectorySelect(directory: string) {
    if (!directory) return;

    const isNewProject = !Object.values(serverState.projects).some(
      (p) => p.worktree === directory,
    );

    const { projectId, sessionId } = await openCodeApi.openProject(directory);
    options.ge.sendToWorker({
      type: 'load-sessions',
      directory,
    });
    await sessionSelection.switchSession(projectId, sessionId);

    if (isNewProject && projectId !== 'global') {
      void initProjectNameFromPackageJson(projectId, directory);
    }
  }

  async function handleNewSessionInSandbox(payload: { worktree: string; directory: string }) {
    await createSessionInDirectory(payload.directory);
  }

  function handleTopPanelSessionSelect(payload: {
    projectId?: string;
    worktree: string;
    directory: string;
    sessionId: string;
  }) {
    if (
      sessionSelection.selectedSessionId.value === payload.sessionId &&
      sessionSelection.activeDirectory.value === payload.directory &&
      sessionSelection.projectDirectory.value === payload.worktree
    ) {
      return;
    }
    const projectId =
      payload.projectId ||
      resolveProjectIdForDirectory(payload.directory) ||
      resolveProjectIdForDirectory(payload.worktree) ||
      sessionSelection.selectedProjectId.value;
    void sessionSelection.switchSession(projectId, payload.sessionId);
  }

  function handleNotificationSessionSelect() {
    const queue = notificationSessionOrder.value.filter((key) => {
      const entry = serverState.notifications[key];
      return Boolean(entry && entry.requestIds.length > 0);
    });
    if (queue.length === 0) return;
    const currentSessionId = sessionSelection.selectedSessionId.value;
    const nextKey = queue.find((key) => key !== currentSessionId) ?? queue[0];
    if (!nextKey) return;
    const entry = serverState.notifications[nextKey];
    if (!entry) return;
    void sessionSelection.switchSession(entry.projectId.trim(), entry.sessionId.trim());
  }

  async function bootstrapSelections() {
    if (options.isBootstrapping.value) return;
    options.isBootstrapping.value = true;
    try {
      if (!serverState.bootstrapped.value) {
        await new Promise<void>((resolve, reject) => {
          const stop = watch(
            options.bootstrapReady,
            (ready) => {
              if (!ready) return;
              stop();
              clearTimeout(timer);
              resolve();
            },
            { immediate: true },
          );
          const timer = setTimeout(() => {
            stop();
            reject(new Error('Bootstrap timed out waiting for server state.'));
          }, 30_000);
        });
      }

      const initialProjectId = initialQuery.projectId.trim();
      const initialSessionId = initialQuery.sessionId.trim();
      if (initialProjectId && initialSessionId) {
        await sessionSelection.switchSession(initialProjectId, initialSessionId);
      } else {
        await sessionSelection.initialize();
      }

      if (sessionSelection.activeDirectory.value) {
        await options.fetchCommands(sessionSelection.activeDirectory.value);
      }
    } finally {
      options.isBootstrapping.value = false;
    }
  }

  async function reloadSelectedSessionState() {
    if (
      sessionSelection.selectedSessionId.value &&
      options.isBootstrapping.value &&
      !sessionSelection.activeDirectory.value
    ) {
      return;
    }
    options.fw.closeAll({ exclude: (key) => key.startsWith('shell:') });
    options.resetFollow();
    options.reasoning.reset();
    options.subagentWindows.reset();
    options.retryStatus.value = null;

    const sessionId = sessionSelection.selectedSessionId.value;
    if (!sessionId) {
      options.focusInput();
      return;
    }

    const hadCache = options.messageMeta.loadCachedHistory(sessionId);
    if (!hadCache) {
      options.msg.reset();
    }
    if (options.msg.roots.value.length === 0) {
      options.scrollOutputPanelToBottom(false);
    }

    const directory = sessionSelection.activeDirectory.value || undefined;

    const asyncTasks: Promise<unknown>[] = [
      options.messageMeta.fetchHistory(sessionId),
    ];

    if (options.uiInitState.value === 'ready') {
      const restored = options.shellManager.restoreShellSessions();
      if (restored) asyncTasks.push(restored);
    }

    void options.reloadTodosForAllowedSessions();
    void options.fetchPendingPermissions(directory);
    void options.fetchPendingQuestions(directory);

    if (!hadCache) {
      await Promise.all(asyncTasks);
    } else {
      void Promise.all(asyncTasks);
    }

    options.focusInput();
  }

  return {
    editingProject,
    projectError,
    worktreeError,
    notificationSessionOrder,
    navigableTree,
    topPanelTreeData,
    currentProjectColor,
    currentProjectName,
    editingProjectMeta,
    notificationSessions,
    todoPanelSessions,
    createNewSession,
    createWorktreeFromWorktree,
    deleteWorktree,
    handleProjectDirectorySelect,
    handleNewSessionInSandbox,
    openProjectPicker,
    handleEditProject,
    handleSaveProject,
    bootstrapSelections,
    handleTopPanelSessionSelect,
    handleNotificationSessionSelect,
    reloadSelectedSessionState,
    validateSelectedSession,
    pickPreferredSessionId,
    sessionSortKey,
    readQuerySelection,
    replaceQuerySelection,
    createSessionInDirectory,
    initProjectNameFromPackageJson,
    resolveProjectIdForDirectory,
  };
}
