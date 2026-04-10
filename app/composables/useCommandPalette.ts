import { computed, ref, type ComputedRef } from 'vue';

export type CommandPaletteSession = {
  id: string;
  projectId: string;
  title?: string;
  slug?: string;
  directory?: string;
};

export type CommandPaletteProject = {
  id: string;
  name: string;
  worktree: string;
};

export type CommandPaletteCommand = {
  name: string;
  description?: string;
  hints?: string[];
};

export type CommandPaletteResult =
  | { type: 'session'; item: CommandPaletteSession }
  | { type: 'project'; item: CommandPaletteProject }
  | { type: 'command'; item: CommandPaletteCommand }
  | { type: 'settings' };

export type CommandPaletteGroup = {
  label: string;
  results: CommandPaletteResult[];
};

export function useCommandPalette(options: {
  sessions: ComputedRef<CommandPaletteSession[]>;
  projects: ComputedRef<CommandPaletteProject[]>;
  commands: ComputedRef<CommandPaletteCommand[]>;
}) {
  const isOpen = ref(false);
  const query = ref('');

  function open() {
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
    query.value = '';
  }

  function toggle() {
    if (isOpen.value) {
      close();
    } else {
      open();
    }
  }

  function scoreMatch(text: string, queryStr: string): number {
    const lowerText = text.toLowerCase();
    const lowerQuery = queryStr.toLowerCase().trim();
    if (!lowerQuery) return 1;
    if (lowerText === lowerQuery) return 100;
    if (lowerText.startsWith(lowerQuery)) return 50;
    if (lowerText.includes(lowerQuery)) return 25;
    let textIdx = 0;
    let queryIdx = 0;
    let consecutive = 0;
    let maxConsecutive = 0;
    while (textIdx < lowerText.length && queryIdx < lowerQuery.length) {
      if (lowerText[textIdx] === lowerQuery[queryIdx]) {
        queryIdx++;
        consecutive++;
        maxConsecutive = Math.max(maxConsecutive, consecutive);
      } else {
        consecutive = 0;
      }
      textIdx++;
    }
    if (queryIdx < lowerQuery.length) return 0;
    return 5 + maxConsecutive * 2;
  }

  const filteredResults = computed<CommandPaletteGroup[]>(() => {
    const q = query.value.trim();
    const groups: CommandPaletteGroup[] = [];

    const sessionScores = options.sessions.value
      .map((session) => {
        const searchText = [session.title, session.slug, session.id].filter(Boolean).join(' ');
        const score = scoreMatch(searchText, q);
        return { session, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (sessionScores.length > 0) {
      groups.push({
        label: 'Sessions',
        results: sessionScores.map(({ session }) => ({ type: 'session' as const, item: session })),
      });
    }

    const projectScores = options.projects.value
      .map((project) => {
        const searchText = [project.name, project.worktree, project.id].filter(Boolean).join(' ');
        const score = scoreMatch(searchText, q);
        return { project, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    if (projectScores.length > 0) {
      groups.push({
        label: 'Projects',
        results: projectScores.map(({ project }) => ({ type: 'project' as const, item: project })),
      });
    }

    const commandScores = options.commands.value
      .map((command) => {
        const searchText = [command.name, command.description].filter(Boolean).join(' ');
        const score = scoreMatch(searchText, q);
        return { command, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (commandScores.length > 0) {
      groups.push({
        label: 'Commands',
        results: commandScores.map(({ command }) => ({ type: 'command' as const, item: command })),
      });
    }

    const settingsScore = scoreMatch('Settings', q);
    if (settingsScore > 0) {
      groups.push({
        label: 'Preferences',
        results: [{ type: 'settings' as const }],
      });
    }

    return groups;
  });

  const flatResults = computed<CommandPaletteResult[]>(() =>
    filteredResults.value.flatMap((group) => group.results),
  );

  return {
    isOpen,
    query,
    open,
    close,
    toggle,
    filteredResults,
    flatResults,
  };
}
