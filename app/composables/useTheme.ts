import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { StorageKeys, storageGet, storageSet } from '../utils/storageKeys';

export type ThemeMode = 'light' | 'dark' | 'system';

const VALID_MODES: ThemeMode[] = ['light', 'dark', 'system'];

function getInitialMode(): ThemeMode {
  const raw = storageGet(StorageKeys.settings.themeMode);
  if (raw && (VALID_MODES as string[]).includes(raw)) {
    return raw as ThemeMode;
  }
  return 'system';
}

function getSystemIsDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const mode = ref<ThemeMode>(getInitialMode());

const resolvedMode = computed<'light' | 'dark'>(() => {
  if (mode.value === 'system') {
    return getSystemIsDark() ? 'dark' : 'light';
  }
  return mode.value;
});

export function useTheme() {
  let mediaQuery: MediaQueryList | null = null;

  function updateDocumentClass() {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    html.classList.remove('theme-light', 'theme-dark');
    html.classList.add(`theme-${resolvedMode.value}`);
  }

  function handleMediaChange() {
    if (mode.value === 'system') {
      updateDocumentClass();
    }
  }

  function setMode(next: ThemeMode) {
    mode.value = next;
    storageSet(StorageKeys.settings.themeMode, next);
    updateDocumentClass();
  }

  function toggle() {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const nextIndex = (order.indexOf(mode.value) + 1) % order.length;
    setMode(order[nextIndex]!);
  }

  onMounted(() => {
    updateDocumentClass();
    if (typeof window !== 'undefined') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener?.('change', handleMediaChange);
    }
  });

  onBeforeUnmount(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener?.('change', handleMediaChange);
    }
  });

  watch(mode, (next) => {
    storageSet(StorageKeys.settings.themeMode, next);
    updateDocumentClass();
  });

  return {
    mode,
    resolvedMode,
    toggle,
    setMode,
  };
}
