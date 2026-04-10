import * as opencodeApi from '../utils/opencode';
import { splitFileContentDirectoryAndPath } from '../utils/path';
import { toErrorMessage } from '../utils/formatters';
import ContentViewer from '../components/viewers/ContentViewer.vue';
import DiffViewer from '../components/viewers/DiffViewer.vue';
import { guessLanguageFromPath } from '../components/ToolWindow/utils';
import type { useFloatingWindows } from './useFloatingWindows';
import { usePtyOneshot } from './usePtyOneshot';
import { getCanvasMetrics, getFileViewerPosition } from '../utils/floatingWindowGeometry';
import {
  COMMIT_SNAPSHOT_SCRIPT,
  FILE_SNAPSHOT_SCRIPT,
  buildWorktreeSnapshotScript,
  parseCommitSnapshotOutput,
  parseFileSnapshotOutput,
  type WorktreeSnapshotMode,
} from '../utils/gitSnapshots';
import type { MessageDiffEntry } from '../types/message';

type FloatingWindowManager = ReturnType<typeof useFloatingWindows>;

const FILE_VIEWER_WINDOW_WIDTH = 840;
const FILE_VIEWER_WINDOW_HEIGHT = 520;

export type FileContentResponse = {
  content?: string;
  encoding?: string;
  type?: 'text' | 'binary';
};

function toFileViewerKey(path: string, lines?: string): string {
  if (!lines) return `file-viewer:${path}`;
  return `file-viewer:${path}:${lines}`;
}

export function useFileViewers(
  fw: FloatingWindowManager,
  deps: {
    getDirectory: () => string;
    getShikiTheme: () => string;
    resolvePath?: (path?: string) => string | undefined;
  },
) {
  const { getDirectory, getShikiTheme, resolvePath } = deps;
  const { runOneShotPtyCommand } = usePtyOneshot();

  function toFileViewerTitle(path: string, lines?: string): string {
    const base = resolvePath?.(path) || path;
    if (!lines) return base;
    return `${base}:${lines}`;
  }

  async function openFileViewer(path: string, lines?: string): Promise<void> {
    const key = toFileViewerKey(path, lines);
    if (fw.has(key)) {
      fw.bringToFront(key);
      return;
    }
    const metrics = getCanvasMetrics(document.querySelector('.tool-window-canvas'));
    const pos = metrics
      ? getFileViewerPosition(metrics, FILE_VIEWER_WINDOW_WIDTH, FILE_VIEWER_WINDOW_HEIGHT, 0.18, 0.14)
      : { x: 24, y: 24 };
    const lang = guessLanguageFromPath(path);
    fw.open(key, {
      component: ContentViewer,
      props: {
        path,
        lang,
        lines,
        gutterMode: 'default',
        theme: getShikiTheme(),
      },
      closable: true,
      resizable: true,
      focusOnOpen: true,
      scroll: 'manual',
      title: toFileViewerTitle(path, lines),
      x: pos.x,
      y: pos.y,
      width: FILE_VIEWER_WINDOW_WIDTH,
      height: FILE_VIEWER_WINDOW_HEIGHT,
      expiry: Infinity,
    });
    const directory = getDirectory().trim();
    if (!directory) {
      fw.updateOptions(key, {
        props: {
          path,
          rawHtml: 'No active directory selected.',
          lines,
          gutterMode: 'none',
          theme: getShikiTheme(),
        },
      });
      return;
    }

    try {
      const requestPath = splitFileContentDirectoryAndPath(path, directory);
      const data = (await opencodeApi.readFileContent({
        directory: requestPath.directory,
        path: requestPath.path,
      })) as FileContentResponse;
      const type = data?.type === 'binary' ? 'binary' : 'text';
      const encoding = typeof data?.encoding === 'string' ? data.encoding : 'utf-8';
      const content = typeof data?.content === 'string' ? data.content : '';
      const isBase64Payload = encoding === 'base64';
      if (type === 'binary' || isBase64Payload) {
        if (!content) {
          fw.updateOptions(key, {
            props: {
              path,
              rawHtml:
                'Binary content is not included in this API response.\nUnable to render hexdump for this file.',
              lines,
              gutterMode: 'none',
              theme: getShikiTheme(),
            },
          });
          return;
        }
        fw.updateOptions(key, {
          props: {
            path,
            binaryBase64: content,
            lang: guessLanguageFromPath(path),
            lines,
            gutterMode: 'default',
            theme: getShikiTheme(),
          },
        });
        return;
      }
      const resolvedLang = guessLanguageFromPath(path);
      fw.updateOptions(key, {
        props: {
          path,
          fileContent: content,
          lang: resolvedLang,
          lines,
          gutterMode: 'default',
          theme: getShikiTheme(),
        },
      });
    } catch (error) {
      fw.updateOptions(key, {
        props: {
          path,
          rawHtml: `File load failed: ${toErrorMessage(error)}`,
          lines,
          gutterMode: 'none',
          theme: getShikiTheme(),
        },
      });
    }
  }

  async function openGitDiff(payload: { path: string; staged: boolean }): Promise<void> {
    const { path, staged } = payload;
    const key = `git-diff:${staged ? 'staged' : 'changes'}:${path}`;
    if (fw.has(key)) {
      fw.bringToFront(key);
      return;
    }

    const mode = staged ? 'staged' : 'unstaged';
    const metrics = getCanvasMetrics(document.querySelector('.tool-window-canvas'));
    const pos = metrics
      ? getFileViewerPosition(metrics, FILE_VIEWER_WINDOW_WIDTH, FILE_VIEWER_WINDOW_HEIGHT)
      : { x: 24, y: 24 };
    await fw.open(key, {
      content: `Loading ${mode} diff for ${path}...`,
      lang: 'text',
      variant: 'plain',
      closable: true,
      resizable: true,
      focusOnOpen: true,
      scroll: 'manual',
      title: `${path} (${mode})`,
      x: pos.x,
      y: pos.y,
      width: FILE_VIEWER_WINDOW_WIDTH,
      height: FILE_VIEWER_WINDOW_HEIGHT,
      expiry: Infinity,
    });

    try {
      const output = await runOneShotPtyCommand('bash', [
        '--noprofile',
        '--norc',
        '-c',
        FILE_SNAPSHOT_SCRIPT,
        '_',
        mode,
        path,
      ]);
      const snapshot = parseFileSnapshotOutput(output);
      if (!fw.has(key)) return;
      await fw.open(key, {
        component: DiffViewer,
        props: {
          path,
          isDiff: true,
          diffCode: snapshot.before,
          diffAfter: snapshot.after,
          diffCodeBase64: snapshot.beforeBase64,
          diffAfterBase64: snapshot.afterBase64,
          gutterMode: 'double',
          lang: guessLanguageFromPath(path),
          theme: getShikiTheme(),
        },
        closable: true,
        resizable: true,
        focusOnOpen: true,
        scroll: 'manual',
        title: `${path} (${mode})`,
        x: pos.x,
        y: pos.y,
        width: FILE_VIEWER_WINDOW_WIDTH,
        height: FILE_VIEWER_WINDOW_HEIGHT,
        expiry: Infinity,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('File snapshot failed', error);
      if (fw.has(key)) {
        await fw.close(key);
      }
    }
  }

  async function openAllGitDiff(mode: WorktreeSnapshotMode = 'all'): Promise<void> {
    const key = `git-diff:${mode}`;
    if (fw.has(key)) {
      fw.bringToFront(key);
      return;
    }

    const metrics = getCanvasMetrics(document.querySelector('.tool-window-canvas'));
    const pos = metrics
      ? getFileViewerPosition(metrics, FILE_VIEWER_WINDOW_WIDTH, FILE_VIEWER_WINDOW_HEIGHT)
      : { x: 24, y: 24 };
    await fw.open(key, {
      content: 'Loading all changes...',
      lang: 'text',
      variant: 'plain',
      closable: true,
      resizable: true,
      focusOnOpen: true,
      scroll: 'manual',
      title: 'Loading...',
      x: pos.x,
      y: pos.y,
      width: FILE_VIEWER_WINDOW_WIDTH,
      height: FILE_VIEWER_WINDOW_HEIGHT,
      expiry: Infinity,
    });

    try {
      const output = await runOneShotPtyCommand('bash', [
        '--noprofile',
        '--norc',
        '-c',
        buildWorktreeSnapshotScript(mode),
      ]);
      const snapshot = parseCommitSnapshotOutput(output);
      if (snapshot.files.length === 0) {
        throw new Error('no files parsed from working tree snapshot');
      }
      if (!fw.has(key)) return;

      const first = snapshot.files[0];
      const title =
        snapshot.title ||
        (snapshot.files.length === 1 ? first.file : `${snapshot.files.length} files changed`);
      const diffTabs =
        snapshot.files.length > 1
          ? snapshot.files.map((entry) => ({
              file: entry.file,
              before: entry.before,
              after: entry.after,
              beforeBase64: entry.beforeBase64,
              afterBase64: entry.afterBase64,
            }))
          : undefined;

      await fw.open(key, {
        component: DiffViewer,
        props: {
          path: first.file,
          isDiff: true,
          diffCode: first.before,
          diffAfter: first.after,
          diffCodeBase64: first.beforeBase64,
          diffAfterBase64: first.afterBase64,
          diffTabs,
          gutterMode: 'double',
          lang: snapshot.files.length === 1 ? guessLanguageFromPath(first.file) : 'text',
          theme: getShikiTheme(),
        },
        title,
        closable: true,
        resizable: true,
        focusOnOpen: true,
        scroll: 'manual',
        x: pos.x,
        y: pos.y,
        width: FILE_VIEWER_WINDOW_WIDTH,
        height: FILE_VIEWER_WINDOW_HEIGHT,
        expiry: Infinity,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Working tree snapshot failed', error);
      if (fw.has(key)) {
        await fw.close(key);
      }
    }
  }

  function handleShowMessageDiff(payload: {
    messageKey: string;
    diffs: Array<MessageDiffEntry>;
  }): void {
    const { messageKey, diffs } = payload;
    if (!diffs || diffs.length === 0) return;
    const key = `message-diff:${messageKey}`;
    if (fw.has(key)) {
      fw.bringToFront(key);
      return;
    }
    const hasBeforeAfter = diffs.some(
      (d) => typeof d.before === 'string' && typeof d.after === 'string',
    );
    const combinedDiff = hasBeforeAfter ? '' : diffs.map((d) => d.diff).join('\n');
    const fileCount = diffs.length;
    const title = fileCount === 1 ? diffs[0].file : `${fileCount} files changed`;
    const firstFile = diffs[0]?.file ?? '';

    let diffTabs: Array<{ file: string; before: string; after: string }> | undefined;
    if (hasBeforeAfter && fileCount > 1) {
      diffTabs = diffs
        .filter((d) => typeof d.before === 'string' && typeof d.after === 'string')
        .map((d) => ({
          file: d.file,
          before: d.before!,
          after: d.after!,
        }));
    }

    const metrics = getCanvasMetrics(document.querySelector('.tool-window-canvas'));
    const pos = metrics
      ? getFileViewerPosition(metrics, FILE_VIEWER_WINDOW_WIDTH, FILE_VIEWER_WINDOW_HEIGHT)
      : { x: 24, y: 24 };
    fw.open(key, {
      component: DiffViewer,
      props: {
        path: firstFile,
        isDiff: true,
        diffCode: hasBeforeAfter ? (diffs[0]?.before ?? '') : '',
        diffAfter: hasBeforeAfter ? (diffs[0]?.after ?? '') : undefined,
        diffPatch: hasBeforeAfter ? undefined : combinedDiff,
        diffTabs,
        gutterMode: hasBeforeAfter ? 'double' : 'none',
        lang: fileCount === 1 ? guessLanguageFromPath(firstFile) : 'text',
        theme: getShikiTheme(),
      },
      closable: true,
      resizable: true,
      focusOnOpen: true,
      scroll: 'manual',
      title,
      x: pos.x,
      y: pos.y,
      width: FILE_VIEWER_WINDOW_WIDTH,
      height: FILE_VIEWER_WINDOW_HEIGHT,
      expiry: Infinity,
    });
  }

  async function handleShowCommit(hashRaw: string): Promise<void> {
    const hash = hashRaw.trim();
    if (!/^[0-9a-f]{7,40}$/i.test(hash)) return;
    const key = `commit-diff:${hash}`;
    if (fw.has(key)) {
      fw.bringToFront(key);
      return;
    }

    const metrics = getCanvasMetrics(document.querySelector('.tool-window-canvas'));
    const pos = metrics
      ? getFileViewerPosition(metrics, FILE_VIEWER_WINDOW_WIDTH, FILE_VIEWER_WINDOW_HEIGHT)
      : { x: 24, y: 24 };
    await fw.open(key, {
      content: `Loading commit ${hash}...`,
      lang: 'text',
      variant: 'plain',
      closable: true,
      resizable: true,
      focusOnOpen: true,
      scroll: 'manual',
      title: `commit ${hash}`,
      x: pos.x,
      y: pos.y,
      width: FILE_VIEWER_WINDOW_WIDTH,
      height: FILE_VIEWER_WINDOW_HEIGHT,
      expiry: Infinity,
    });

    try {
      const output = await runOneShotPtyCommand('bash', [
        '--noprofile',
        '--norc',
        '-c',
        COMMIT_SNAPSHOT_SCRIPT,
        '_',
        hash,
      ]);
      const snapshot = parseCommitSnapshotOutput(output);
      if (snapshot.files.length === 0) {
        throw new Error('no files parsed from commit snapshot');
      }
      if (!fw.has(key)) return;

      const first = snapshot.files[0];
      const title =
        snapshot.title ||
        (snapshot.files.length === 1 ? first.file : `${snapshot.files.length} files changed`);
      const diffTabs =
        snapshot.files.length > 1
          ? snapshot.files.map((entry) => ({
              file: entry.file,
              before: entry.before,
              after: entry.after,
              beforeBase64: entry.beforeBase64,
              afterBase64: entry.afterBase64,
            }))
          : undefined;

      await fw.open(key, {
        component: DiffViewer,
        props: {
          path: first.file,
          isDiff: true,
          diffCode: first.before,
          diffAfter: first.after,
          diffCodeBase64: first.beforeBase64,
          diffAfterBase64: first.afterBase64,
          diffTabs,
          gutterMode: 'double',
          lang: snapshot.files.length === 1 ? guessLanguageFromPath(first.file) : 'text',
          theme: getShikiTheme(),
        },
        title,
        closable: true,
        resizable: true,
        focusOnOpen: true,
        scroll: 'manual',
        x: pos.x,
        y: pos.y,
        width: FILE_VIEWER_WINDOW_WIDTH,
        height: FILE_VIEWER_WINDOW_HEIGHT,
        expiry: Infinity,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Commit snapshot failed', error);
      if (fw.has(key)) {
        await fw.close(key);
      }
    }
  }

  return {
    openFileViewer,
    openGitDiff,
    openAllGitDiff,
    handleShowMessageDiff,
    handleShowCommit,
  };
}
