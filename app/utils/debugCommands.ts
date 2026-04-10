import ContentViewer from '../components/viewers/ContentViewer.vue';
import type { useFloatingWindows } from '../composables/useFloatingWindows';
import type { ProjectState } from '../types/worker-state';
import { getCanvasMetrics, getFileViewerPosition } from './floatingWindowGeometry';

type FloatingWindowManager = ReturnType<typeof useFloatingWindows>;

const FILE_VIEWER_WINDOW_WIDTH = 840;
const FILE_VIEWER_WINDOW_HEIGHT = 520;

const DEBUG_SUBCOMMANDS: Record<string, string> = {
  session: 'Show session graph tree',
  notification: 'Dump pending notification state',
};

type NotificationEntry = {
  projectId: string;
  sessionId: string;
  requestIds: string[];
};

type DebugContext = {
  serverState: { projects: Record<string, ProjectState> };
  notificationSessionOrder: string[];
  sessionParentById: Map<string, string | undefined>;
  sessions: Array<{
    id: string;
    title?: string;
    slug?: string;
    status?: string;
    timeUpdated?: number;
    timeCreated?: number;
  }>;
  allowedSessionIds: Set<string>;
  selectedSessionId: string;
  fw: FloatingWindowManager;
  shikiTheme: string;
};

function sessionLabel(session: { title?: string; slug?: string; id: string }): string {
  return session.title || session.slug || session.id;
}

function fmtTime(ts?: number): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

function fmtStatus(s?: string): string {
  if (s === 'busy') return '[BUSY]';
  if (s === 'retry') return '[RETRY]';
  if (s === 'idle') return '[idle]';
  return `[${s ?? 'unknown'}]`;
}

function formatSessionGraphDump(context: DebugContext): string {
  const lines: string[] = [];

  const allProjects = Object.values(context.serverState.projects).sort((a, b) =>
    a.worktree === b.worktree ? a.id.localeCompare(b.id) : a.worktree.localeCompare(b.worktree),
  );
  const totalSessions = allProjects.reduce((count, project) => {
    return (
      count +
      Object.values(project.sandboxes).reduce((projectCount, sandbox) => {
        return projectCount + Object.keys(sandbox.sessions).length;
      }, 0)
    );
  }, 0);

  lines.push('Project Tree (worker-state)');
  lines.push(`  projects: ${allProjects.length}  sessions(total): ${totalSessions}`);
  lines.push('');

  for (const project of allProjects) {
    lines.push(`PROJECT ${project.id}`);
    lines.push(`  worktree: ${project.worktree || '-'}`);
    if (project.name) lines.push(`  name: ${project.name}`);
    if (project.icon?.color) lines.push(`  color: ${project.icon.color}`);
    lines.push(
      `  time: created=${fmtTime(project.time?.created)} updated=${fmtTime(project.time?.updated)} initialized=${fmtTime(project.time?.initialized)}`,
    );

    const sandboxEntries = Object.entries(project.sandboxes).sort(([a], [b]) => a.localeCompare(b));
    if (sandboxEntries.length === 0) {
      lines.push('  (no sandboxes)');
      lines.push('');
      continue;
    }

    for (let si = 0; si < sandboxEntries.length; si++) {
      const [sandboxDirectory, sandbox] = sandboxEntries[si];
      const isLastSandbox = si === sandboxEntries.length - 1;
      const sConnector = isLastSandbox ? '└── ' : '├── ';
      const sPrefix = isLastSandbox ? '    ' : '│   ';

      const branchMeta = sandbox.name ? `  (branch: ${sandbox.name})` : '';
      lines.push(`${sConnector}SANDBOX ${sandboxDirectory}${branchMeta}`);
      lines.push(`${sPrefix}rootSessions: [${sandbox.rootSessions.join(', ')}]`);

      const sessions = Object.values(sandbox.sessions).sort((a, b) => {
        const aTime = a.timeUpdated ?? a.timeCreated ?? 0;
        const bTime = b.timeUpdated ?? b.timeCreated ?? 0;
        return bTime - aTime;
      });

      if (sessions.length === 0) {
        lines.push(`${sPrefix}(no sessions)`);
        continue;
      }

      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        const isLastSession = i === sessions.length - 1;
        const sessionConnector = isLastSession ? '└── ' : '├── ';
        const sessionPrefix = `${sPrefix}${isLastSession ? '    ' : '│   '}`;
        const status = fmtStatus(session.status);
        const title = session.title ? `  "${session.title}"` : '';
        const slug = session.slug ? `  slug=${session.slug}` : '';
        lines.push(
          `${sPrefix}${sessionConnector}${session.id}  ${status}${title}${slug}`,
        );
        const revertLabel = session.revert
          ? `msg=${session.revert.messageID}${session.revert.partID ? ` part=${session.revert.partID}` : ''}`
          : '-';
        lines.push(
          `${sessionPrefix}dir=${session.directory || sandboxDirectory}  parent=${session.parentID || '(root)'}  archived=${fmtTime(session.timeArchived)}  revert=${revertLabel}`,
        );
        lines.push(
          `${sessionPrefix}created=${fmtTime(session.timeCreated)}  updated=${fmtTime(session.timeUpdated)}`,
        );
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

function openDebugSessionViewer(context: DebugContext): void {
  const key = 'debug:session-graph';
  const content = formatSessionGraphDump(context);
  const metrics = getCanvasMetrics(document.querySelector('.tool-window-canvas'));
  const pos = metrics
    ? getFileViewerPosition(metrics, FILE_VIEWER_WINDOW_WIDTH, FILE_VIEWER_WINDOW_HEIGHT, 0.12, 0.08)
    : { x: 24, y: 24 };
  if (context.fw.has(key)) context.fw.close(key);
  context.fw.open(key, {
    component: ContentViewer,
    props: {
      fileContent: content,
      lang: 'text',
      gutterMode: 'none',
      theme: context.shikiTheme,
    },
    closable: true,
    resizable: true,
    focusOnOpen: true,
    scroll: 'manual',
    title: 'Debug: Session Graph',
    x: pos.x,
    y: pos.y,
    width: FILE_VIEWER_WINDOW_WIDTH,
    height: FILE_VIEWER_WINDOW_HEIGHT,
    expiry: Infinity,
  });
}

export function runDebugCommand(
  context: DebugContext,
  notificationMap: Record<string, NotificationEntry>,
  fwEntries: Array<{ key: string; props?: Record<string, unknown> }>,
  args: string,
): { ok: boolean; message: string } {
  const sub = args.trim().toLowerCase();
  if (!sub || sub === 'help') {
    const lines = ['Available /debug subcommands:'];
    for (const [name, desc] of Object.entries(DEBUG_SUBCOMMANDS)) {
      lines.push(`  ${name} — ${desc}`);
    }
    return { ok: true, message: lines.join('\n') };
  }
  if (sub === 'session' || sub === 'sessions') {
    openDebugSessionViewer(context);
    return { ok: true, message: 'Session graph opened.' };
  }
  if (sub === 'notification' || sub === 'notifications') {
    openDebugNotificationViewer(context, notificationMap, fwEntries);
    return { ok: true, message: 'Notification dump opened.' };
  }
  return {
    ok: false,
    message: `Unknown debug subcommand: ${sub}. Type /debug help for a list.`,
  };
}

function openDebugNotificationViewer(
  context: DebugContext,
  notificationMap: Record<string, NotificationEntry>,
  fwEntries: Array<{ key: string; props?: Record<string, unknown> }>,
): void {
  const lines: string[] = [];
  const order = context.notificationSessionOrder;
  const parentMap = context.sessionParentById;

  lines.push(`Notification State`);
  lines.push(`  pendingNotificationsBySessionId: ${Object.keys(notificationMap).length} session(s)`);
  lines.push(`  notificationSessionOrder: [${order.length}] ${order.join(', ') || '(empty)'}`);
  lines.push(`  selectedSessionId: ${context.selectedSessionId || '(none)'}`);
  lines.push(`  allowedSessionIds: [${context.allowedSessionIds.size}]`);
  lines.push('');

  const topPanelBadgeCounts = new Map<string, number>();
  for (const entry of Object.values(notificationMap)) {
    const rootId = parentMap.get(entry.sessionId) || entry.sessionId;
    topPanelBadgeCounts.set(rootId, (topPanelBadgeCounts.get(rootId) || 0) + entry.requestIds.length);
  }
  const computedNotificationSessions = Array.from(topPanelBadgeCounts.entries())
    .filter(([sessionId]) => order.includes(sessionId))
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([sessionId, count]) => ({ sessionId, count }));

  lines.push(
    `Computed notificationSessions (TopPanel badge): ${computedNotificationSessions.length} entry(s), total count = ${computedNotificationSessions.reduce((s, e) => s + e.count, 0)}`,
  );
  for (const entry of computedNotificationSessions) {
    const session = context.sessions.find((s) => s.id === entry.sessionId);
    const label = session ? sessionLabel(session) : '(unknown session)';
    const parentId = parentMap.get(entry.sessionId);
    const parentInfo = parentId ? ` parent=${parentId}` : ' (root)';
    lines.push(`  ${entry.sessionId}  count=${entry.count}  "${label}"${parentInfo}`);
  }
  lines.push('');

  lines.push(`Full pendingNotificationsBySessionId:`);
  if (Object.keys(notificationMap).length === 0) {
    lines.push('  (empty)');
  }
  for (const entry of Object.values(notificationMap)) {
    const projectId = entry.projectId;
    const sessionId = entry.sessionId;
    const session = context.sessions.find((s) => s.id === sessionId);
    const label = session ? sessionLabel(session) : '(unknown session)';
    const parentId = parentMap.get(sessionId);
    const parentInfo = parentId ? ` parent=${parentId}` : ' (root)';
    const flags: string[] = [];
    if (sessionId === context.selectedSessionId) flags.push('SELECTED');
    if (context.allowedSessionIds.has(sessionId)) flags.push('ALLOWED');
    if (parentId) flags.push('CHILD');
    const flagStr = flags.length > 0 ? `  [${flags.join(', ')}]` : '';
    lines.push(`  ${projectId}:${sessionId}  "${label}"${parentInfo}${flagStr}`);
    for (const requestId of entry.requestIds) {
      const isIdle = requestId.startsWith('idle:');
      const type = isIdle ? 'idle' : 'permission/question';
      lines.push(`    - ${requestId}  (${type})`);
    }
  }
  lines.push('');

  const mapKeys = Object.keys(notificationMap);
  const orphanedInOrder = order.filter((id) => !mapKeys.includes(id));
  const missingFromOrder = mapKeys.filter((id) => !order.includes(id));
  if (orphanedInOrder.length > 0 || missingFromOrder.length > 0) {
    lines.push(`Consistency Issues:`);
    if (orphanedInOrder.length > 0) {
      lines.push(`  In notificationSessionOrder but NOT in map: ${orphanedInOrder.join(', ')}`);
    }
    if (missingFromOrder.length > 0) {
      lines.push(`  In map but NOT in notificationSessionOrder: ${missingFromOrder.join(', ')}`);
    }
    lines.push('');
  }

  const permissionEntries = fwEntries.filter((e) => e.key.startsWith('permission:'));
  const questionEntries = fwEntries.filter((e) => e.key.startsWith('question:'));
  lines.push(`Active Floating Windows:`);
  lines.push(`  Permission windows: ${permissionEntries.length}`);
  for (const entry of permissionEntries) {
    const req = entry.props?.request as { id?: string; sessionID?: string } | undefined;
    lines.push(`    - ${entry.key}  session=${req?.sessionID ?? '?'}  request=${req?.id ?? '?'}`);
  }
  lines.push(`  Question windows: ${questionEntries.length}`);
  for (const entry of questionEntries) {
    const req = entry.props?.request as { id?: string; sessionID?: string } | undefined;
    lines.push(`    - ${entry.key}  session=${req?.sessionID ?? '?'}  request=${req?.id ?? '?'}`);
  }

  const key = 'debug:notification';
  const content = lines.join('\n');
  const metrics = getCanvasMetrics(document.querySelector('.tool-window-canvas'));
  const pos = metrics
    ? getFileViewerPosition(metrics, FILE_VIEWER_WINDOW_WIDTH, FILE_VIEWER_WINDOW_HEIGHT, 0.15, 0.1)
    : { x: 24, y: 24 };
  if (context.fw.has(key)) context.fw.close(key);
  context.fw.open(key, {
    component: ContentViewer,
    props: {
      fileContent: content,
      lang: 'text',
      gutterMode: 'none',
      theme: context.shikiTheme,
    },
    closable: true,
    resizable: true,
    focusOnOpen: true,
    scroll: 'manual',
    title: 'Debug: Notifications',
    x: pos.x,
    y: pos.y,
    width: FILE_VIEWER_WINDOW_WIDTH,
    height: FILE_VIEWER_WINDOW_HEIGHT,
    expiry: Infinity,
  });
}
