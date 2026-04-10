# Set up Vitest test infrastructure and write core unit tests

## Problem
Vis currently has zero automated tests:
```json
"test": "echo \"Error: no test specified\" && exit 1"
```

The most critical logic lives in `app/utils/stateBuilder.ts` and `app/utils/toolRenderers.ts`, which are also the most frightening to refactor without safety nets.

## Goal
Add a Vitest test suite with high-value unit tests for core state and rendering utilities.

## Plan

### Phase 1: Install Vitest & Configure
- Add dev dependencies: `vitest`, `@vitest/ui`, `@vue/test-utils` (for future component tests)
- Add scripts to `package.json`:
  - `"test": "vitest run"`
  - `"test:ui": "vitest --ui"`
  - `"test:watch": "vitest"`
- Create `vitest.config.ts` extending `vite.config.ts` with:
  - `environment: 'node'` for utils, `environment: 'happy-dom'` reserved for future UI tests
  - `globals: true`
  - `coverage` provider (`v8`) configured but not enforced

### Phase 2: Unit Tests for `stateBuilder.ts`
**Test file:** `app/utils/__tests__/stateBuilder.test.ts`
Test the following behaviors:
- `applyProjects` creates projects and sandbox maps correctly
- `upsertSession` places root sessions under the correct sandbox
- `upsertSession` places child sessions under the **root** session's sandbox (not the parent's)
- `applyStatuses` updates session status (`busy`, `idle`, `retry`)
- `resolveRootSessionIdInProject` correctly walks parent chains
- `collectDescendantIds` returns all descendants via BFS
- `pruneEphemeralChildren` removes stale child sessions after TTL
- `applyVcsInfo` updates sandbox branch names
- Immutable change detection: updating the same session twice with identical data returns `false`/`null`

### Phase 3: Unit Tests for `toolRenderers.ts`
**Test file:** `app/utils/__tests__/toolRenderers.test.ts`
- Mock `ToolRenderersHelpers` with jest-style vi.fn() mocks
- Test `extractToolPatch` with valid `apply_patch` payloads
- Test `extractFileRead` for each tool type (`bash`, `read`, `grep`, `glob`, `list`, `edit`, `multiedit`, `webfetch`, `websearch`, `codesearch`, `task`, `write`)
- Verify correct `variant` returned (`code`, `diff`, `term`, `plain`)
- Verify title/path resolution logic
- Test fallback behavior for unknown tools

### Phase 4: Unit Tests for Composable Utilities
**Test file:** `app/utils/__tests__/waitForState.test.ts`
- Test `waitForState` resolves immediately when predicate is true
- Test `waitForState` resolves after reactive change
- Test `waitForState` rejects on timeout

### Phase 5: Optional Worker Tests
**Test file:** `app/workers/__tests__/sse-shared-worker.test.ts` (if feasible)
- Extract pure validation functions (`isSessionInfo`, `isProjectInfo`, etc.) into a testable module or test them via exports if possible
- Test `parseWorkerStatePacket` with valid/invalid packets for each event type

### Phase 6: CI / Build Integration
- Ensure `npm test` runs in CI (GitHub Actions if a workflow exists, otherwise just ensure the script works)
- Add a pre-commit recommendation in `CONTRIBUTING.md` (if it exists)
- Run tests as part of the PR checklist

## Acceptance Criteria
- [ ] `npm test` runs and passes
- [ ] `stateBuilder.ts` has >80% line coverage
- [ ] `toolRenderers.ts` has >80% line coverage
- [ ] `waitForState.ts` has tests
- [ ] No regressions in build (`npm run build` passes)
