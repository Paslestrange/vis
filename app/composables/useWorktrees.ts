import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import { usePtyOneshot } from './usePtyOneshot';
import type { ProjectState } from '../types/worker-state';

export type WorktreeDirtyState = 'clean' | 'modified' | 'staged';

export type WorktreeItem = {
  directory: string;
  branch: string;
  isActive: boolean;
  isMain: boolean;
  dirtyState: WorktreeDirtyState;
  ahead: number;
  behind: number;
};

export type UseWorktreesOptions = {
  activeDirectory: Ref<string>;
  currentProject: Ref<ProjectState | undefined>;
  activeGitBranchInfo?: Ref<{ ahead: number; behind: number } | null | undefined>;
};

const GIT_ENV_PREAMBLE = [
  'stty -opost -echo 2>/dev/null',
  'export GIT_PAGER=cat',
  'export GIT_TERMINAL_PROMPT=0',
  'export NO_COLOR=1',
  'export GIT_CONFIG_NOSYSTEM=1',
  'export TERM=dumb',
].join('\n');

function stripAnsi(value: string) {
  const ansiPattern = new RegExp(`${String.raw`\u001b`}\\[[0-?]*[ -/]*[@-~]`, 'g');
  return value.replace(ansiPattern, '');
}

function parseAheadBehind(output: string): { ahead: number; behind: number } {
  const cleaned = stripAnsi(output).trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return {
      ahead: Number.parseInt(parts[0], 10) || 0,
      behind: Number.parseInt(parts[1], 10) || 0,
    };
  }
  return { ahead: 0, behind: 0 };
}

function parseGitStatusSummary(output: string): { modified: boolean; staged: boolean } {
  const cleaned = stripAnsi(output).replace(/\r/g, '');
  const lines = cleaned.split('\n').filter(Boolean);
  let modified = false;
  let staged = false;
  for (const line of lines) {
    if (line.startsWith('##')) continue;
    if (line.length < 2) continue;
    const index = line[0];
    const worktree = line[1];
    if (index !== ' ' && index !== '?') staged = true;
    if (worktree !== ' ' || index === '?') modified = true;
  }
  return { modified, staged };
}

function normalizeDirectory(value: string) {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed || value;
}

export function useWorktrees(options: UseWorktreesOptions) {
  const { activeDirectory, currentProject, activeGitBranchInfo } = options;
  const worktrees = ref<WorktreeItem[]>([]);
  const loading = ref(false);
  let refreshGeneration = 0;

  const { runOneShotPtyCommand } = usePtyOneshot();

  async function fetchWorktreeGitStatus(
    directory: string,
    isActive: boolean,
  ): Promise<{ dirtyState: WorktreeDirtyState; ahead: number; behind: number }> {
    if (isActive && activeGitBranchInfo?.value) {
      const aheadBehindScript = [
        `cd "${directory}"`,
        GIT_ENV_PREAMBLE,
        'git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0',
        'git -c color.status=false -c color.ui=false --no-pager status --porcelain=v1 2>/dev/null',
      ].join('\n');
      try {
        const statusOutput = await runOneShotPtyCommand('bash', [
          '--noprofile',
          '--norc',
          '-c',
          aheadBehindScript,
        ]);
        const summary = parseGitStatusSummary(statusOutput);
        let dirtyState: WorktreeDirtyState = 'clean';
        if (summary.staged) dirtyState = 'staged';
        else if (summary.modified) dirtyState = 'modified';
        return {
          dirtyState,
          ahead: activeGitBranchInfo.value.ahead,
          behind: activeGitBranchInfo.value.behind,
        };
      } catch {
        void 0;
      }
    }

    const script = [
      `cd "${directory}"`,
      GIT_ENV_PREAMBLE,
      'git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0',
      'git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "0\\t0"',
      "printf '\\0##STATUS\\0'",
      'git -c color.status=false -c color.ui=false --no-pager status --porcelain=v1 2>/dev/null',
    ].join('\n');

    try {
      const output = await runOneShotPtyCommand('bash', ['--noprofile', '--norc', '-c', script]);
      const tokens = output.split('\0');
      let aheadBehindOutput = '0\t0';
      let statusOutput = '';
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]?.trim() ?? '';
        if (token === '##STATUS' && i + 1 < tokens.length) {
          statusOutput = tokens[i + 1] ?? '';
        } else if (i === 0) {
          aheadBehindOutput = token;
        }
      }
      const { ahead, behind } = parseAheadBehind(aheadBehindOutput);
      const summary = parseGitStatusSummary(statusOutput);
      let dirtyState: WorktreeDirtyState = 'clean';
      if (summary.staged) dirtyState = 'staged';
      else if (summary.modified) dirtyState = 'modified';
      return { dirtyState, ahead, behind };
    } catch {
      return { dirtyState: 'clean', ahead: 0, behind: 0 };
    }
  }

  async function refreshWorktrees() {
    const project = currentProject.value;
    if (!project) {
      worktrees.value = [];
      return;
    }
    const generation = ++refreshGeneration;
    loading.value = true;

    const sandboxes = Object.values(project.sandboxes);
    const mainWorktree = project.worktree;

    const items: WorktreeItem[] = [];
    for (const sandbox of sandboxes) {
      const isActive = normalizeDirectory(sandbox.directory) === normalizeDirectory(activeDirectory.value);
      const gitInfo = await fetchWorktreeGitStatus(sandbox.directory, isActive);
      if (generation !== refreshGeneration) return;
      items.push({
        directory: sandbox.directory,
        branch: sandbox.name || 'unknown',
        isActive,
        isMain: normalizeDirectory(sandbox.directory) === normalizeDirectory(mainWorktree),
        dirtyState: gitInfo.dirtyState,
        ahead: gitInfo.ahead,
        behind: gitInfo.behind,
      });
    }

    if (generation !== refreshGeneration) return;
    worktrees.value = items.sort((a, b) => {
      if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
      return a.directory.localeCompare(b.directory);
    });
    loading.value = false;
  }

  watch(
    () => [currentProject.value?.id, activeDirectory.value, activeGitBranchInfo?.value],
    () => {
      void refreshWorktrees();
    },
    { immediate: true },
  );

  return {
    worktrees,
    loading,
    refreshWorktrees,
  };
}
