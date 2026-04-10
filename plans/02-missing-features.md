# Add missing OpenCode UI features (MCP, skills, structured output, search, diagnostics)

## Background
Vis is an alternative UI for OpenCode, but it lags behind the server API in several high-value features. The backend already exposes endpoints and SSE events that Vis currently ignores or has no UI for.

## Goal
Close the feature-gap with current OpenCode by adding UI for MCP management, skills browsing, structured output, global file search, and LSP diagnostics.

## Plan

### 1. MCP Server Management Panel
**Files:** New component `app/components/McpManager.vue`, new modal/settings section
- Add REST wrappers in `app/utils/opencode.ts`:
  - `GET /mcp` → `listMcpServers()`
  - `POST /mcp` → `addMcpServer(payload)`
  - `DELETE /mcp/{name}` → `removeMcpServer(name)`
  - `POST /mcp/{name}/connect` → `connectMcpServer(name)`
  - `POST /mcp/{name}/disconnect` → `disconnectMcpServer(name)`
  - `POST /mcp/{name}/oauth/authorize` → `authorizeMcpOauth(name, payload)`
- Create a new settings modal or expand `ProjectSettingsDialog` to host an MCP tab
- List servers with name, status, tools count
- Add/Remove/Connect/Disconnect actions
- Handle SSE `mcp.tools.changed` in `useGlobalEvents.ts` and refresh the MCP list reactively

### 2. Skills Browser
**Files:** New component `app/components/SkillsBrowser.vue` or new SidePanel tab
- Add `GET /skill` → `listSkills()` in `app/utils/opencode.ts`
- Add a new tab in `SidePanel.vue` (Todo | Tree | Skills)
- Render skills as a searchable list with name, description, triggers
- Allow clicking a skill to insert its trigger into the composer (nice-to-have)

### 3. Structured Output Rendering
**Files:** `app/components/ThreadBlock.vue`, `app/components/renderers/JsonRenderer.vue`
- `AssistantMessageInfo.structured` currently exists in types but is never rendered
- In `ThreadBlock` / `MessageViewer`, detect when `assistantMessage.structured` is present
- Add a new `JsonRenderer` component with syntax highlighting (via existing `CodeRenderer` or raw Shiki)
- Toggle between "Rendered" (pretty JSON tree) and "Source" views
- Consider adding a "Copy JSON" button

### 4. Global Fuzzy File Search (Ctrl+P style)
**Files:** New component `app/components/FuzzyFileSearch.vue`
- Add `GET /find/file?query=` → `findFiles(query)` in `app/utils/opencode.ts`
- Bind `Ctrl+P` / `Cmd+P` in App.vue to open a floating modal
- Modal shows a search input + filtered results list
- Enter opens the file in `ContentViewer`; arrow keys navigate
- Escape closes

### 5. LSP Diagnostics Panel
**Files:** New component `app/components/DiagnosticsPanel.vue`
- Listen to SSE `lsp.client.diagnostics` in `useGlobalEvents.ts` and route to a store/composable
- Create `app/composables/useLspDiagnostics.ts` to aggregate diagnostics by path
- Add a floating window or SidePanel sub-tab that lists errors/warnings/hints per file
- Clicking a diagnostic opens the file viewer at the relevant line

### 6. Session Sharing & Summarize
**Files:** `app/components/ThreadFooter.vue`, `app/utils/opencode.ts`
- Add `POST /session/{id}/share` → `shareSession(sessionId)`
- Add `POST /session/{id}/summarize` → `summarizeSession(sessionId)`
- Add "Share" and "Summarize" buttons in `ThreadFooter.vue`
- Share button copies URL to clipboard; Summarize button triggers API and shows a loading state

### 7. Handle Additional SSE Events
- `installation.updated` / `installation.update-available` → show a subtle "Update available" banner in `TopPanel.vue`
- `command.executed` → log slash commands in a hidden debug log (optional)

## Acceptance Criteria
- [ ] MCP manager can list, add, remove, connect, disconnect servers
- [ ] Skills browser is accessible and shows available skills
- [ ] Structured JSON output is visible in assistant messages
- [ ] Ctrl+P opens fuzzy file search and can open files
- [ ] LSP diagnostics are visible in a dedicated panel
- [ ] All new features are typed and build passes
