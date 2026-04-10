import { ref, computed, watch } from 'vue';
import { StorageKeys, storageGetJSON, storageSetJSON } from '../utils/storageKeys';

export function useSessionTags() {
  const sessionTags = ref<Record<string, string[]>>(
    storageGetJSON<Record<string, string[]>>(StorageKeys.session.tags) ?? {},
  );
  const sessionFavourites = ref<Record<string, boolean>>(
    storageGetJSON<Record<string, boolean>>(StorageKeys.session.favourites) ?? {},
  );

  watch(
    sessionTags,
    (val) => {
      storageSetJSON(StorageKeys.session.tags, val);
    },
    { deep: true },
  );

  watch(
    sessionFavourites,
    (val) => {
      storageSetJSON(StorageKeys.session.favourites, val);
    },
    { deep: true },
  );

  const allTags = computed(() => {
    const set = new Set<string>();
    for (const tags of Object.values(sessionTags.value)) {
      for (const tag of tags) {
        set.add(tag);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  function getTags(sessionId: string): string[] {
    return sessionTags.value[sessionId] ?? [];
  }

  function setTags(sessionId: string, tags: string[]) {
    const next = { ...sessionTags.value };
    if (tags.length === 0) {
      delete next[sessionId];
    } else {
      next[sessionId] = tags;
    }
    sessionTags.value = next;
  }

  function addTag(sessionId: string, tag: string) {
    const normalized = tag.trim();
    if (!normalized) return;
    const current = getTags(sessionId);
    if (current.includes(normalized)) return;
    setTags(sessionId, [...current, normalized]);
  }

  function removeTag(sessionId: string, tag: string) {
    const current = getTags(sessionId).filter((t) => t !== tag);
    setTags(sessionId, current);
  }

  function isFavourite(sessionId: string): boolean {
    return sessionFavourites.value[sessionId] ?? false;
  }

  function toggleFavourite(sessionId: string) {
    const next = { ...sessionFavourites.value };
    if (next[sessionId]) {
      delete next[sessionId];
    } else {
      next[sessionId] = true;
    }
    sessionFavourites.value = next;
  }

  return {
    sessionTags,
    sessionFavourites,
    allTags,
    getTags,
    setTags,
    addTag,
    removeTag,
    isFavourite,
    toggleFavourite,
  };
}
