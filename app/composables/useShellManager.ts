import { nextTick } from 'vue';
import { Terminal } from '@xterm/xterm';
import * as opencodeApi from '../utils/opencode';
import ShellContent from '../components/ToolWindow/Shell.vue';
import type { useFloatingWindows } from './useFloatingWindows';
import { getCanvasMetrics, getRandomWindowPosition } from '../utils/floatingWindowGeometry';

type FloatingWindowManager = ReturnType<typeof useFloatingWindows>;

export type PtyInfo = {
  id: string;
  title: string;
  command: string;
  args: string[];
  cwd: string;
  status: 'running' | 'exited';
  pid: number;
};

type ShellSession = {
  pty: PtyInfo;
  terminal: Terminal;
  socket?: WebSocket;
  exiting?: boolean;
  closeOnSuccess?: boolean;
  exitResolve?: (exitCode: number) => void;
};

const SHELL_LINGER_MS = 1000;
const TERM_COLUMNS = 80;
const TERM_ROWS = 25;
const TERM_FONT_SIZE_PX = 13;
const TERM_LINE_HEIGHT = 1.1;
const TERM_TITLEBAR_HEIGHT_PX = 22;
const TERM_WINDOW_BORDER_PX = 2;
const TERM_INNER_PADDING_X_PX = 4;
const TERM_INNER_PADDING_Y_PX = 4;
const TERM_GUTTER_WIDTH_EM = 3.2;
const TERM_FONT_FAMILY =
  "'Iosevka Term', 'Iosevka Fixed', 'JetBrains Mono', 'Cascadia Mono', 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace";

function measureTerminalCellWidth(fontFamily: string, fontSizePx: number): number {
  if (typeof document === 'undefined') return fontSizePx * 0.62;
  const probe = document.createElement('span');
  probe.textContent = 'MMMMMMMMMM';
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.whiteSpace = 'pre';
  probe.style.fontFamily = fontFamily;
  probe.style.fontSize = `${fontSizePx}px`;
  probe.style.lineHeight = String(TERM_LINE_HEIGHT);
  document.body.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  const width = rect.width / 10;
  return Number.isFinite(width) && width > 0 ? width : fontSizePx * 0.62;
}

function getTerminalWindowSize(): { width: number; height: number } {
  const cellWidth = measureTerminalCellWidth(TERM_FONT_FAMILY, TERM_FONT_SIZE_PX);
  const lineHeightPx = TERM_FONT_SIZE_PX * TERM_LINE_HEIGHT;
  const gutterWidthPx = TERM_FONT_SIZE_PX * TERM_GUTTER_WIDTH_EM;
  const contentWidth = TERM_COLUMNS * cellWidth;
  const contentHeight = TERM_ROWS * lineHeightPx;
  const width = Math.ceil(
    contentWidth + gutterWidthPx + TERM_INNER_PADDING_X_PX + TERM_WINDOW_BORDER_PX,
  );
  const height = Math.ceil(
    contentHeight + TERM_TITLEBAR_HEIGHT_PX + TERM_INNER_PADDING_Y_PX + TERM_WINDOW_BORDER_PX,
  );
  return { width, height };
}

export function syncCanvasTermMetrics(canvas: HTMLElement | null): void {
  if (!canvas) return;
  const { width, height } = getTerminalWindowSize();
  canvas.style.setProperty('--term-font-family', TERM_FONT_FAMILY);
  canvas.style.setProperty('--term-font-size', `${TERM_FONT_SIZE_PX}px`);
  canvas.style.setProperty('--term-line-height', String(TERM_LINE_HEIGHT));
  canvas.style.setProperty('--term-width', `${width}px`);
  canvas.style.setProperty('--term-height', `${height}px`);
}

function parsePtyInfo(value: unknown): PtyInfo | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : undefined;
  const title = typeof record.title === 'string' ? record.title : '';
  const command = typeof record.command === 'string' ? record.command : '';
  const args = Array.isArray(record.args) ? record.args.map((arg) => String(arg)) : [];
  const cwd = typeof record.cwd === 'string' ? record.cwd : '';
  const status =
    record.status === 'running' || record.status === 'exited' ? record.status : 'running';
  const pid = typeof record.pid === 'number' ? record.pid : 0;
  if (!id) return null;
  return { id, title, command, args, cwd, status, pid };
}

async function fetchPtyList(directory?: string): Promise<PtyInfo[]> {
  const data = await opencodeApi.listPtys(directory);
  if (!Array.isArray(data)) return [];
  return data.map(parsePtyInfo).filter((pty): pty is PtyInfo => Boolean(pty));
}

function buildPtyWsUrl(path: string, directory?: string): string {
  return opencodeApi.createWsUrl(path, { directory });
}

async function updatePtySize(
  ptyId: string,
  rows: number,
  cols: number,
  directory?: string,
): Promise<PtyInfo | null> {
  const data = await opencodeApi.updatePtySize(ptyId, {
    directory,
    rows,
    cols,
  });
  return parsePtyInfo(data);
}

export function useShellManager(
  fw: FloatingWindowManager,
  deps: {
    getDirectory: () => string;
    getCanvasEl: () => HTMLElement | null;
    onTreeCommandSuccess?: () => void;
    log?: (message: string, error?: unknown) => void;
  },
) {
  const { getDirectory, getCanvasEl, onTreeCommandSuccess, log = console.log } = deps;

  const shellSessionsByPtyId = new Map<string, ShellSession>();
  const pendingShellFits = new Set<string>();
  const shellExitWaiters = new Map<string, (exitCode: number) => void>();
  let shellDirectory = '';

  function ensureShellWindow(pty: PtyInfo): void {
    if (shellSessionsByPtyId.has(pty.id)) return;
    const key = `shell:${pty.id}`;
    const { width, height } = getTerminalWindowSize();
    const metrics = getCanvasMetrics(getCanvasEl());
    const randomPosition = metrics
      ? getRandomWindowPosition(metrics, { width, height })
      : { x: 0, y: 0 };
    fw.open(key, {
      component: ShellContent,
      props: { shellId: pty.id },
      closable: true,
      resizable: true,
      scroll: 'none',
      color: '#a855f7',
      title: pty.title || 'Shell',
      width,
      height,
      x: randomPosition.x,
      y: randomPosition.y,
      expiry: Infinity,
      onResize: () => scheduleShellFit(pty.id),
    });
    const terminal = new Terminal({
      cols: TERM_COLUMNS,
      rows: TERM_ROWS,
      fontFamily: TERM_FONT_FAMILY,
      fontSize: TERM_FONT_SIZE_PX,
      lineHeight: TERM_LINE_HEIGHT,
      cursorBlink: true,
      theme: {
        background: '#050505',
        foreground: '#e2e8f0',
        cursor: '#e2e8f0',
        selectionBackground: 'rgba(148, 163, 184, 0.3)',
      },
    });
    shellSessionsByPtyId.set(pty.id, {
      pty,
      terminal,
    });
    connectShellSocket(pty.id);
    nextTick(() => {
      const host = getCanvasEl()?.querySelector(`[data-shell-id="${pty.id}"]`) as HTMLElement | null;
      if (!host) return;
      terminal.open(host);
      requestAnimationFrame(() => {
        resizeWindowToFitTerminal(key, terminal, host);
      });
    });
  }

  function resizeWindowToFitTerminal(key: string, terminal: Terminal, _host: HTMLElement) {
    const cell = getTerminalCellSize(terminal);
    if (!cell) return;

    const viewport = terminal.element?.querySelector('.xterm-viewport') as HTMLElement | null;
    const scrollbarWidth = viewport ? viewport.offsetWidth - viewport.clientWidth : 0;

    const contentWidth = terminal.cols * cell.width + scrollbarWidth;
    const contentHeight = terminal.rows * cell.height;

    const chromeX = TERM_WINDOW_BORDER_PX + 2 * TERM_INNER_PADDING_X_PX;
    const chromeY = TERM_WINDOW_BORDER_PX + TERM_TITLEBAR_HEIGHT_PX + 1 + TERM_INNER_PADDING_Y_PX;

    const newWidth = Math.ceil(contentWidth + chromeX);
    const newHeight = Math.ceil(contentHeight + chromeY);

    fw.updateOptions(key, { width: newWidth, height: newHeight });

    const session = shellSessionsByPtyId.get(key.replace('shell:', ''));
    if (session) notifyPtySize(session);
  }

  function scheduleShellFitAll(): void {
    shellSessionsByPtyId.forEach((_, ptyId) => {
      scheduleShellFit(ptyId);
    });
  }

  function getTerminalCellSize(terminal: Terminal): { width: number; height: number } | null {
    const termEl = terminal.element;
    if (termEl && terminal.cols > 0 && terminal.rows > 0) {
      const screen = termEl.querySelector('.xterm-screen');
      if (screen) {
        const rect = screen.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return { width: rect.width / terminal.cols, height: rect.height / terminal.rows };
        }
      }
    }
    const core = (terminal as any)._core;
    const dims = core?._renderService?.dimensions?.css?.cell;
    if (dims?.width > 0 && dims?.height > 0) {
      return { width: dims.width, height: dims.height };
    }
    return null;
  }

  function fitTerminalToContainer(session: ShellSession): boolean {
    const termEl = session.terminal.element;
    if (!termEl?.isConnected) return false;
    const parent = termEl.parentElement;
    if (!parent) return false;
    const parentRect = parent.getBoundingClientRect();
    if (parentRect.width <= 0 || parentRect.height <= 0) return false;

    const cell = getTerminalCellSize(session.terminal);
    if (!cell) return false;

    const viewport = termEl.querySelector('.xterm-viewport') as HTMLElement | null;
    const scrollbarWidth = viewport ? viewport.offsetWidth - viewport.clientWidth : 0;

    const cols = Math.max(2, Math.floor((parentRect.width - scrollbarWidth) / cell.width));
    const rows = Math.max(1, Math.floor(parentRect.height / cell.height));
    if (cols !== session.terminal.cols || rows !== session.terminal.rows) {
      session.terminal.resize(cols, rows);
    }
    return true;
  }

  function notifyPtySize(session: ShellSession): void {
    const { rows, cols } = session.terminal;
    if (rows > 0 && cols > 0) {
      const directory = session.pty.cwd || getDirectory() || undefined;
      updatePtySize(session.pty.id, rows, cols, directory).catch((error) => {
        log('PTY resize failed', error);
      });
    }
  }

  function scheduleShellFit(ptyId: string): void {
    if (pendingShellFits.has(ptyId)) return;
    pendingShellFits.add(ptyId);
    nextTick(() => {
      pendingShellFits.delete(ptyId);
      const session = shellSessionsByPtyId.get(ptyId);
      if (!session) return;
      const currentSession = session;

      let prevCols = -1;
      let prevRows = -1;
      let attempts = 0;

      function tick() {
        if (attempts >= 30 || !currentSession.terminal.element?.isConnected) {
          notifyPtySize(currentSession);
          return;
        }
        attempts++;
        fitTerminalToContainer(currentSession);
        const { cols, rows } = currentSession.terminal;
        if (cols === prevCols && rows === prevRows) {
          notifyPtySize(currentSession);
          return;
        }
        prevCols = cols;
        prevRows = rows;
        requestAnimationFrame(tick);
      }

      tick();
    });
  }

  function connectShellSocket(ptyId: string): void {
    const session = shellSessionsByPtyId.get(ptyId);
    if (!session) return;
    const directory = session.pty.cwd || getDirectory() || undefined;
    const url = buildPtyWsUrl(`/pty/${ptyId}/connect`, directory);
    const socket = new WebSocket(url);
    session.socket = socket;
    socket.binaryType = 'arraybuffer';
    const ptyMetaDecoder = new TextDecoder();
    socket.addEventListener('message', (event) => {
      if (event.data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(event.data);
        if (bytes.length > 0 && bytes[0] === 0) {
          const json = ptyMetaDecoder.decode(bytes.subarray(1));
          try {
            const meta = JSON.parse(json) as { cursor?: unknown };
            if (
              typeof meta.cursor === 'number' &&
              Number.isSafeInteger(meta.cursor) &&
              meta.cursor >= 0
            ) {
              return;
            }
          } catch {
            return;
          }
          return;
        }
        session.terminal.write(bytes);
        return;
      }
      if (typeof event.data === 'string') {
        const trimmed = event.data.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const meta = JSON.parse(trimmed) as { cursor?: unknown } & Record<string, unknown>;
            const keys = Object.keys(meta);
            if (
              keys.length === 1 &&
              keys[0] === 'cursor' &&
              typeof meta.cursor === 'number' &&
              Number.isSafeInteger(meta.cursor) &&
              meta.cursor >= 0
            ) {
              return;
            }
          } catch {
            // fall through to terminal output
          }
        }
        session.terminal.write(event.data);
      }
    });
    socket.addEventListener('open', () => {
      if (session.terminal.element) {
        session.terminal.focus();
      } else {
        nextTick(() => session.terminal.focus());
      }
    });
    session.terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    });
    socket.addEventListener('close', () => {
      if (session.exiting) {
        setTimeout(() => removeShellWindow(ptyId), SHELL_LINGER_MS);
      }
    });
  }

  function removeShellWindow(ptyId: string, options?: { kill?: boolean }): void {
    const session = shellSessionsByPtyId.get(ptyId);
    if (!session) return;
    pendingShellFits.delete(ptyId);
    session.socket?.close();
    session.terminal.dispose();
    shellSessionsByPtyId.delete(ptyId);
    shellExitWaiters.delete(ptyId);
    fw.close(`shell:${ptyId}`);
    if (options?.kill) {
      const directory = session.pty.cwd || getDirectory() || undefined;
      opencodeApi.deletePty(ptyId, directory).catch((error) => {
        log('PTY delete failed', error);
      });
    }
  }

  function lingerAndRemoveShellWindow(ptyId: string): void {
    const session = shellSessionsByPtyId.get(ptyId);
    if (!session || session.exiting) return;
    session.exiting = true;
    session.terminal.options.cursorBlink = false;
    if (!session.socket || session.socket.readyState >= WebSocket.CLOSING) {
      setTimeout(() => removeShellWindow(ptyId), SHELL_LINGER_MS);
    }
  }

  function disposeShellWindows(): void {
    const ids = Array.from(shellSessionsByPtyId.keys());
    ids.forEach((ptyId) => removeShellWindow(ptyId));
  }

  async function restoreShellSessions(): Promise<void> {
    const directory = getDirectory() || '';
    const sandboxChanged = directory !== shellDirectory;
    shellDirectory = directory;
    if (sandboxChanged) {
      disposeShellWindows();
    }
    try {
      const ptys = await fetchPtyList(directory || undefined);
      ptys.forEach((pty) => {
        if (pty.status === 'exited') return;
        if (pty.title === 'One-shot PTY' || pty.title === 'Commit Snapshot') return;
        ensureShellWindow(pty);
      });
    } catch (error) {
      log('PTY restore failed', error);
    }
  }

  async function createPtySession(command?: string, args?: string[]): Promise<PtyInfo | null> {
    const directory = getDirectory() || undefined;
    const data = await opencodeApi.createPty({
      directory,
      command,
      args,
      cwd: directory,
      title: 'Shell',
    });
    return parsePtyInfo(data);
  }

  async function openShellFromInput(input: string): Promise<void> {
    const script = input.trim();
    const hasCommand = script.length > 0;
    const pty = hasCommand
      ? await createPtySession('/bin/sh', ['-c', script])
      : await createPtySession();
    if (!pty) return;
    ensureShellWindow(pty);
    if (!hasCommand) return;
    const session = shellSessionsByPtyId.get(pty.id);
    if (session) session.closeOnSuccess = true;
  }

  async function runTreeShellCommand(command: string): Promise<void> {
    const script = command.trim();
    if (!script) return;
    const pty = await createPtySession('/bin/sh', ['-c', script]);
    if (!pty) return;
    ensureShellWindow(pty);
    const session = shellSessionsByPtyId.get(pty.id);
    if (session) session.closeOnSuccess = true;
    const exitCode = await new Promise<number>((resolve) => {
      shellExitWaiters.set(pty.id, resolve);
    });
    if (exitCode === 0) {
      onTreeCommandSuccess?.();
    }
  }

  function handlePtyEvent(event: {
    type: 'pty.created' | 'pty.updated' | 'pty.exited';
    info: PtyInfo | null;
    id?: string;
    exitCode?: number;
  }): void {
    const ptyId = event.id ?? event.info?.id;
    if (!ptyId) return;
    if (!shellSessionsByPtyId.has(ptyId)) return;
    if (event.type === 'pty.exited') {
      const exitCode = typeof event.exitCode === 'number' ? event.exitCode : -1;
      const waiter = shellExitWaiters.get(ptyId);
      if (waiter) {
        shellExitWaiters.delete(ptyId);
        waiter(exitCode);
      }
      const session = shellSessionsByPtyId.get(ptyId);
      if (session?.closeOnSuccess && exitCode !== 0) {
        session.terminal.write(`\r\n\u001b[31m[Command failed: ${exitCode}]\u001b[0m\r\n`);
        return;
      }
      lingerAndRemoveShellWindow(ptyId);
      return;
    }
    if (event.info) {
      const existing = shellSessionsByPtyId.get(event.info.id);
      if (existing) {
        existing.pty = event.info;
        if (event.info.title) {
          fw.setTitle(`shell:${event.info.id}`, event.info.title);
        }
      }
      if (event.info.status === 'exited') {
        if (existing?.closeOnSuccess) return;
        lingerAndRemoveShellWindow(event.info.id);
      }
    }
  }

  function tryCloseShellWindow(key: string): boolean {
    if (!key.startsWith('shell:')) return false;
    const ptyId = key.slice('shell:'.length);
    removeShellWindow(ptyId, { kill: true });
    return true;
  }

  return {
    ensureShellWindow,
    removeShellWindow,
    lingerAndRemoveShellWindow,
    disposeShellWindows,
    restoreShellSessions,
    openShellFromInput,
    runTreeShellCommand,
    handlePtyEvent,
    tryCloseShellWindow,
    scheduleShellFitAll,
    syncCanvasTermMetrics,
  };
}
