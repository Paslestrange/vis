# Refactor App.vue: Decompose the 5,900-line monolith into maintainable composables

## Problem
`app/App.vue` has grown to ~5,900 lines. It currently holds:
- Connection/bootstrap logic
- Shell/PTY management (WebSocket, xterm lifecycle)
- File viewer & diff viewer orchestration
- Git snapshot scripting (inline bash heredocs)
- Composer draft CRUD
- Global keyboard shortcuts
- Project/session/worktree CRUD orchestration
- Permission & question floating-window orchestration
- Debug command handling (`/debug session`, `/debug notification`)
- Tool window rendering helpers and patch parsing

This makes the file impossible to unit test, terrifying to modify, and a high-conflict surface.

## Goal
Reduce `App.vue` to a thin layout orchestrator (~500–800 lines) by extracting cohesive domains into dedicated composables and utility modules.

## Plan

### Phase 1: Extract bash / git snapshot scripts
**File:** `app/utils/gitSnapshots.ts`
- Move `COMMIT_SNAPSHOT_SCRIPT`
- Move `FILE_SNAPSHOT_SCRIPT`
- Move `buildWorktreeSnapshotScript`
- Export typed functions: `getCommitSnapshot(hash)`, `getFileSnapshot(path)`, `getWorktreeSnapshot()`
- Keep `runOneShotPtyCommand` calls in App.vue for now, but use the new module for script generation.

### Phase 2: Extract shell / PTY management
**New composable:** `app/composables/useShellManager.ts`
- Move `shellSessionsByPtyId`, `shellExitWaiters`, `ptyWebsocket`, `autoClosePtyIds`
- Move `runOneShotPtyCommand`, `spawnPtyShell`, `openShellWindow`, `updatePtySize`, `lingerAndRemoveShellWindow`, `disposeShellWindows`
- Move `handlePtyEvent` and WebSocket lifecycle
- Expose API: `{ runOneShot, spawnShell, openShellWindow, updateSize, disposeAll, handlePtyEvent }`

### Phase 3: Extract file / diff / viewer orchestration
**New composable:** `app/composables/useFileViewers.ts`
- Move `openFileViewer`, `openGitDiff`, `openAllGitDiff`
- Move `handleShowMessageDiff`, `handleShowCommit`
- Move `parseCommitSnapshotOutput`, `buildWorktreeSnapshotScript` usage
- Move `guessLanguage` (or make it a shared utility)
- Expose API: `{ openFile, openDiff, showMessageDiff, showCommitDiff }`
- Keep `fw` (floating window manager) injected as a dependency to avoid circular coupling.

### Phase 4: Extract debug command handlers
**New utility:** `app/utils/debugCommands.ts`
- Move `/debug session`, `/debug notification`, `/debug file`, `/debug tree`, `/clear`, `/help` handlers
- Export `executeDebugCommand(input, context)` where context carries needed refs/state

### Phase 5: Extract permission / question / todo window orchestration
- Move permission window opening logic from App.vue into `usePermissions.ts` (or a new `usePermissionWindows.ts`)
- Move question window opening logic similarly
- Keep event listeners in App.vue, but make them 1-liners delegating to the composables.

### Phase 6: Extract retry status / session status UI logic
- Move `applySessionStatusEvent`, `formatRetryTime`, `retryStatus` ref handling into a dedicated composable or fold into existing `useSessionSelection` if appropriate.

### Phase 7: Final App.vue cleanup
- Remove all extracted code
- Ensure imports are clean
- Verify no remaining function definitions longer than ~100 lines inside App.vue
- Run `npm run typecheck` or `vue-tsc --noEmit` if available

## Acceptance Criteria
- [ ] `App.vue` is under 1,000 lines
- [ ] All extracted modules have strict TypeScript types
- [ ] No regressions in: shell windows, file viewers, diff viewers, debug commands, permission/question windows
- [ ] `npm run build` passes
- [ ] `npm run lint` passes (or no new lint errors)
