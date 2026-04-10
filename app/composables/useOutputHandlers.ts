import { nextTick, type Ref, type ComputedRef } from 'vue';
import { bundledThemes } from 'shiki/bundle/web';
import { storageGet, storageSet, StorageKeys } from '../utils/storageKeys';
import type { UseServerState } from './useServerState';
import { useShellManager } from './useShellManager';
import { useFloatingWindows } from './useFloatingWindows';
import type { SessionScope, MainSessionScope } from './useGlobalEvents';
import type { useAutoScroller } from './useAutoScroller';
import type { runDebugCommand as RunDebugCommandFn } from '../utils/debugCommands';

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

type RunDebugCommand = typeof RunDebugCommandFn;

type AutoScroller = Pick<
  ReturnType<typeof useAutoScroller>,
  'enableFollow' | 'resetFollow' | 'pauseFollow' | 'resumeFollow' | 'scrollToBottom'
>;

type GlobalEvents = ReturnType<typeof import('./useGlobalEvents').useGlobalEvents>;

export type UseOutputHandlersOptions = {
  shellManager: ReturnType<typeof useShellManager>;
  fw: ReturnType<typeof useFloatingWindows>;
  toolWindowCanvasEl: Ref<HTMLDivElement | null>;
  inputEl: Ref<HTMLElement | null>;
  appEl: Ref<HTMLElement | null>;
  inputPanelRef: Ref<{ focus: () => void; reset: () => void } | null>;
  outputPanelRef: Ref<{ panelEl: HTMLDivElement | null } | null>;
  sidePanelCollapsed: Ref<boolean>;
  sidePanelActiveTab: Ref<'todo' | 'tree' | 'worktrees'>;
  sidePanelWidth: Ref<number | null>;
  shikiTheme: Ref<string>;
  sendStatus: Ref<string>;
  serverState: UseServerState;
  sessions: ComputedRef<SessionInfo[]>;
  selectedSessionId: Ref<string>;
  activeDirectory: Ref<string>;
  projectDirectory: Ref<string>;
  notificationSessionOrder: Ref<string[]>;
  sessionParentById: ComputedRef<Map<string, string | undefined>>;
  allowedSessionIds: ComputedRef<Set<string>>;
  busyDescendantSessionIds: ComputedRef<string[]>;
  runDebugCommand: RunDebugCommand;
  autoScroller: AutoScroller;
  notifyContentChange: () => void;
  ge: GlobalEvents;
  sessionScope: SessionScope;
  mainSessionScope: MainSessionScope;
  connectionState: Ref<'connecting' | 'bootstrapping' | 'ready' | 'reconnecting' | 'error'>;
  uiInitState: Ref<'loading' | 'ready' | 'error' | 'login'>;
  homePath: Ref<string>;
};

export function useOutputHandlers(options: UseOutputHandlersOptions) {
  const {
    shellManager,
    fw,
    toolWindowCanvasEl,
    inputEl,
    inputPanelRef,
    sidePanelCollapsed,
    sidePanelActiveTab,
    sidePanelWidth,
    shikiTheme,
    sendStatus,
    serverState,
    sessions,
    selectedSessionId,
    activeDirectory,
    notificationSessionOrder,
    sessionParentById,
    allowedSessionIds,
    runDebugCommand,
    autoScroller,
    notifyContentChange,
    connectionState,
    uiInitState,
    homePath,
  } = options;

  let floatingExtentResizeObserver: ResizeObserver | null = null;
  let floatingExtentObservedEl: HTMLDivElement | null = null;

  function handleWindowResize() {
    shellManager.syncCanvasTermMetrics(toolWindowCanvasEl.value);
    syncFloatingExtent();
    shellManager.scheduleShellFitAll();
  }

  function syncFloatingExtent() {
    const canvas = toolWindowCanvasEl.value;
    const header = document.querySelector('.app-header') as HTMLElement | null;
    const input = inputEl.value;
    if (!canvas || !header || !input) return;
    const headerRect = header.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const headerBottom = headerRect.bottom;
    const inputTop = inputRect.top;
    const topOffset = Math.max(0, headerBottom);
    const availableHeight = Math.max(0, inputTop - headerBottom);
    canvas.style.setProperty('--canvas-top', `${topOffset}px`);
    canvas.style.setProperty('--canvas-height', `${availableHeight}px`);
    const rect = canvas.getBoundingClientRect();
    fw.setExtent(rect.width, rect.height);
  }

  function updateFloatingExtentObserver() {
    if (typeof ResizeObserver === 'undefined') return;
    if (!floatingExtentResizeObserver) {
      floatingExtentResizeObserver = new ResizeObserver(() => {
        syncFloatingExtent();
      });
    }
    const nextEl = toolWindowCanvasEl.value;
    if (floatingExtentObservedEl && floatingExtentObservedEl !== nextEl) {
      floatingExtentResizeObserver.unobserve(floatingExtentObservedEl);
    }
    if (nextEl && nextEl !== floatingExtentObservedEl) {
      floatingExtentResizeObserver.observe(nextEl);
    }
    floatingExtentObservedEl = nextEl ?? null;
    if (nextEl) syncFloatingExtent();
  }

  function runAppDebugCommand(args: string): { ok: boolean; message: string } {
    return runDebugCommand(
      {
        serverState: { projects: serverState.projects },
        notificationSessionOrder: notificationSessionOrder.value,
        sessionParentById: sessionParentById.value,
        sessions: sessions.value.map((s) => ({
          id: s.id,
          title: s.title,
          slug: s.slug,
          status: s.status,
          timeUpdated: s.time?.updated,
          timeCreated: s.time?.created,
        })),
        allowedSessionIds: allowedSessionIds.value,
        selectedSessionId: selectedSessionId.value,
        fw,
        shikiTheme: shikiTheme.value,
      },
      serverState.notifications,
      fw.entries.value.map((e) => ({ key: e.key, props: e.props })),
      args,
    );
  }

  function handleOutputPanelMessageRendered() {
    notifyContentChange();
  }

  function handleOutputPanelResumeFollow() {
    autoScroller.resumeFollow();
  }

  function handleOutputPanelContentResized() {
    notifyContentChange();
  }

  function handleOutputPanelInitialRenderComplete() {
    nextTick(() => {
      autoScroller.scrollToBottom(false);
      syncFloatingExtent();
      inputPanelRef.value?.focus();
    });
  }

  function handleFloatingWindowClose(key: string) {
    if (shellManager.tryCloseShellWindow(key)) return;
    void fw.close(key);
  }

  function getBundledThemeNames() {
    if (Array.isArray(bundledThemes)) {
      return bundledThemes
        .map((theme) => {
          if (typeof theme === 'string') return theme;
          if (theme && typeof theme === 'object' && 'name' in theme) return String(theme.name ?? '');
          return '';
        })
        .filter((name) => name.length > 0);
    }
    return Object.keys(bundledThemes);
  }

  function pickShikiTheme(names: string[]) {
    if (names.length === 0) return 'github-dark';
    const preferred = [
      'github-dark',
      'github-dark-dimmed',
      'vitesse-dark',
      'dark-plus',
      'nord',
      'dracula',
      'monokai',
    ];
    for (const theme of preferred) {
      if (names.includes(theme)) return theme;
    }
    const darkMatch = names.find((name) => /dark|night|nord|dracula|monokai/i.test(name));
    return darkMatch ?? names[0];
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

  function sessionLabel(session: SessionInfo) {
    return session.title || session.slug || session.id;
  }

  function getSelectedWorktreeDirectory() {
    return activeDirectory.value.trim();
  }

  function resolveWorktreeRelativePath(path?: string) {
    if (!path) return undefined;
    const normalizedPath = normalizeDirectory(path);
    const base = normalizeDirectory(getSelectedWorktreeDirectory());
    if (!base) return replaceHomePrefix(normalizedPath);
    if (!normalizedPath.startsWith('/')) return normalizedPath;
    if (normalizedPath === base) return '.';
    const prefix = `${base}/`;
    if (normalizedPath.startsWith(prefix)) return normalizedPath.slice(prefix.length);
    return replaceHomePrefix(normalizedPath);
  }

  function requireSelectedWorktree(_context: 'send') {
    const directory = getSelectedWorktreeDirectory();
    if (directory) return directory;
    const message = 'No worktree selected.';
    sendStatus.value = message;
    return '';
  }

  function ensureConnectionReady(action: string) {
    if (connectionState.value === 'ready' && uiInitState.value === 'ready') return true;
    if (connectionState.value === 'reconnecting') {
      sendStatus.value = `Reconnecting... ${action} is temporarily disabled.`;
    } else if (uiInitState.value === 'loading') {
      sendStatus.value = `Still loading. ${action} is temporarily disabled.`;
    } else {
      sendStatus.value = `Not connected. ${action} is unavailable.`;
    }
    return false;
  }

  function readSidePanelCollapsed() {
    const raw = storageGet(StorageKeys.state.sidePanelCollapsed);
    return raw === '1';
  }

  function persistSidePanelCollapsed(value: boolean) {
    storageSet(StorageKeys.state.sidePanelCollapsed, value ? '1' : '0');
  }

  function readSidePanelTab(): 'todo' | 'tree' | 'worktrees' {
    const raw = storageGet(StorageKeys.state.sidePanelTab);
    if (raw === 'todo' || raw === 'worktrees') return raw;
    return 'tree';
  }

  function persistSidePanelTab(value: 'todo' | 'tree' | 'worktrees') {
    storageSet(StorageKeys.state.sidePanelTab, value);
  }

  function setSidePanelTab(value: 'todo' | 'tree' | 'worktrees') {
    if (sidePanelActiveTab.value === value) return;
    sidePanelActiveTab.value = value;
    persistSidePanelTab(value);
  }

  function toggleSidePanelCollapsed() {
    sidePanelCollapsed.value = !sidePanelCollapsed.value;
    sidePanelWidth.value = null;
    persistSidePanelCollapsed(sidePanelCollapsed.value);
    nextTick(() => {
      syncFloatingExtent();
      shellManager.scheduleShellFitAll();
    });
  }

  function focusInput() {
    nextTick(() => inputPanelRef.value?.focus());
  }

  return {
    handleWindowResize,
    syncFloatingExtent,
    updateFloatingExtentObserver,
    runAppDebugCommand,
    handleOutputPanelMessageRendered,
    handleOutputPanelResumeFollow,
    handleOutputPanelContentResized,
    handleOutputPanelInitialRenderComplete,
    handleFloatingWindowClose,
    getBundledThemeNames,
    pickShikiTheme,
    normalizeDirectory,
    replaceHomePrefix,
    resolveWorktreeRelativePath,
    sessionLabel,
    getSelectedWorktreeDirectory,
    requireSelectedWorktree,
    ensureConnectionReady,
    readSidePanelCollapsed,
    persistSidePanelCollapsed,
    readSidePanelTab,
    persistSidePanelTab,
    toggleSidePanelCollapsed,
    setSidePanelTab,
    focusInput,
  };
}
