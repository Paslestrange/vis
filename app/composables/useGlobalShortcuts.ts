import type { Ref, ComputedRef } from 'vue';

type NavigableTree = Array<{
  projectId: string;
  sandboxes: Array<{
    sessions: Array<{ id: string; timeUpdated?: number }>;
  }>;
}>;

export function useGlobalShortcuts(options: {
  selectedProjectId: Ref<string>;
  selectedSessionId: Ref<string>;
  navigableTree: ComputedRef<NavigableTree>;
  switchSessionSelection: (projectId: string, sessionId: string) => Promise<void>;
  createNewSession: () => void;
  openShell: (input: string) => void;
  notificationSessions: ComputedRef<Array<{ sessionId: string }>>;
  handleNotificationSessionSelect: () => void;
  focusInput: () => void;
  abortSession: () => void;
  canAbort: ComputedRef<boolean>;
  sidePanelCollapsed: Ref<boolean>;
  toggleSidePanelCollapsed: () => void;
  startInputResize: (event: PointerEvent) => void;
  startSidePanelResize: (event: PointerEvent) => void;
  isSettingsOpen: Ref<boolean>;
  isAnalyticsOpen?: Ref<boolean>;
  isProjectPickerOpen: Ref<boolean>;
  isCommandPaletteOpen: Ref<boolean>;
  toggleCommandPalette: () => void;
  isShortcutHelpOpen?: Ref<boolean>;
  topPanelRef?: Ref<{
    closeSessionDropdown?: () => void;
    toggleSessionDropdown?: () => void;
  } | undefined | null>;
  bringFrontAll?: () => void;
}) {
  const {
    selectedProjectId,
    selectedSessionId,
    navigableTree,
    switchSessionSelection,
    createNewSession,
    openShell,
    notificationSessions,
    handleNotificationSessionSelect,
    focusInput,
    abortSession,
    canAbort,
    sidePanelCollapsed,
    toggleSidePanelCollapsed,
    startInputResize,
    startSidePanelResize,
    isSettingsOpen,
    isAnalyticsOpen,
    isProjectPickerOpen,
    isCommandPaletteOpen,
    toggleCommandPalette,
    isShortcutHelpOpen,
    topPanelRef,
    bringFrontAll,
  } = options;

  function switchSessionByDirection(delta: number) {
    const tree = navigableTree.value;
    const currentProjectId = selectedProjectId.value;
    const worktree = tree.find((w) => w.projectId === currentProjectId);
    if (!worktree) return;
    const flatSessions = worktree.sandboxes.flatMap((s) => s.sessions);
    if (flatSessions.length === 0) return;
    const currentIndex = flatSessions.findIndex((s) => s.id === selectedSessionId.value);
    if (currentIndex < 0) {
      void switchSessionSelection(currentProjectId, flatSessions[0].id);
      return;
    }
    const nextIndex = (currentIndex + delta + flatSessions.length) % flatSessions.length;
    const target = flatSessions[nextIndex];
    if (target.id !== selectedSessionId.value) {
      void switchSessionSelection(currentProjectId, target.id);
    }
  }

  function switchProjectByDirection(delta: number) {
    const tree = navigableTree.value;
    if (tree.length === 0) return;
    const currentIndex = tree.findIndex((w) => w.projectId === selectedProjectId.value);
    const baseIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = (baseIndex + delta + tree.length) % tree.length;
    const target = tree[nextIndex];
    if (!target?.projectId) return;
    const allSessions = target.sandboxes.flatMap((s) => s.sessions);
    if (allSessions.length === 0) return;
    const best = allSessions.reduce((a, b) => ((a.timeUpdated ?? 0) >= (b.timeUpdated ?? 0) ? a : b));
    void switchSessionSelection(target.projectId, best.id);
  }

  let lastEscTime = 0;
  let lastCtrlGTime = 0;
  const DOUBLE_ESC_THRESHOLD = 500;
  const DOUBLE_CTRL_G_THRESHOLD = 500;

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (
      event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'a'
    ) {
      const active = document.activeElement;
      if (active instanceof HTMLDivElement) {
        event.stopPropagation();
        event.preventDefault();
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(active);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
    }

    if (event.ctrlKey && !event.metaKey && !event.altKey && event.key === ';') {
      event.preventDefault();
      createNewSession();
      return;
    }

    if (event.ctrlKey && !event.metaKey && !event.altKey && event.shiftKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      if (isAnalyticsOpen) {
        isAnalyticsOpen.value = true;
      }
      return;
    }

    if (event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      const now = Date.now();
      if (now - lastCtrlGTime < DOUBLE_CTRL_G_THRESHOLD) {
        lastCtrlGTime = 0;
        topPanelRef?.value?.closeSessionDropdown?.();
        if (notificationSessions.value.length > 0) {
          handleNotificationSessionSelect();
        }
        focusInput();
      } else {
        lastCtrlGTime = now;
        topPanelRef?.value?.toggleSessionDropdown?.();
      }
      return;
    }

    if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      createNewSession();
      return;
    }

    if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      openShell('');
      return;
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'k'
    ) {
      event.preventDefault();
      toggleCommandPalette();
      return;
    }

    if (
      event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.shiftKey &&
      event.key.toLowerCase() === 'p'
    ) {
      event.preventDefault();
      toggleCommandPalette();
      return;
    }

    if (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      event.preventDefault();
      switchSessionByDirection(event.key === 'ArrowLeft' ? 1 : -1);
      return;
    }

    if (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown')
    ) {
      event.preventDefault();
      switchProjectByDirection(event.key === 'ArrowUp' ? -1 : 1);
      return;
    }

    if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const active = document.activeElement;
      const isTyping =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active?.getAttribute('contenteditable') === 'true';
      if (!isTyping) {
        event.preventDefault();
        if (isShortcutHelpOpen) {
          isShortcutHelpOpen.value = true;
        }
        return;
      }
    }

    if (event.ctrlKey && !event.metaKey && !event.altKey && event.key === '/') {
      event.preventDefault();
      if (isShortcutHelpOpen) {
        isShortcutHelpOpen.value = true;
      }
      return;
    }

    if (event.key !== 'Escape') return;

    if (isCommandPaletteOpen.value) {
      toggleCommandPalette();
      lastEscTime = 0;
      return;
    }
    if (isShortcutHelpOpen?.value) {
      isShortcutHelpOpen.value = false;
      lastEscTime = 0;
      return;
    }
    if (isSettingsOpen.value) {
      isSettingsOpen.value = false;
      lastEscTime = 0;
      return;
    }
    if (isProjectPickerOpen.value) {
      isProjectPickerOpen.value = false;
      lastEscTime = 0;
      return;
    }

    const now = Date.now();
    if (now - lastEscTime < DOUBLE_ESC_THRESHOLD) {
      lastEscTime = 0;
      if (canAbort.value) {
        abortSession();
      }
    } else {
      lastEscTime = now;
    }
  }

  return { handleGlobalKeydown };
}
