<template>
  <div class="session-tag-input" @click.stop>
    <div class="tag-chips">
      <span v-for="tag in tags" :key="tag" class="tag-chip">
        {{ tag }}
        <button type="button" class="tag-remove" @click.stop.prevent="remove(tag)">
          <Icon icon="lucide:x" :width="10" :height="10" />
        </button>
      </span>
    </div>
    <div class="tag-input-wrap">
      <input
        v-model.trim="inputValue"
        type="text"
        class="tag-input"
        placeholder="Add tag…"
        @keydown.enter.prevent="add"
        @focus="focused = true"
        @blur="onBlur"
      />
      <div v-if="suggestions.length && focused" class="tag-suggestions">
        <button
          v-for="s in suggestions"
          :key="s"
          type="button"
          class="tag-suggestion"
          @mousedown.prevent="selectSuggestion(s)"
        >
          {{ s }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  tags: string[];
  allTags: string[];
}>();

const emit = defineEmits<{
  (e: 'update:tags', tags: string[]): void;
}>();

const inputValue = ref('');
const focused = ref(false);

function onBlur() {
  setTimeout(() => {
    focused.value = false;
  }, 150);
}

const suggestions = computed(() => {
  const val = inputValue.value.toLowerCase();
  const existing = new Set(props.tags);
  const pool = props.allTags.filter((t) => !existing.has(t));
  if (!val) return pool.slice(0, 8);
  return pool.filter((t) => t.toLowerCase().includes(val)).slice(0, 8);
});

function add() {
  const val = inputValue.value.trim();
  if (!val) return;
  if (props.tags.includes(val)) return;
  emit('update:tags', [...props.tags, val]);
  inputValue.value = '';
}

function remove(tag: string) {
  emit('update:tags', props.tags.filter((t) => t !== tag));
}

function selectSuggestion(tag: string) {
  if (props.tags.includes(tag)) return;
  emit('update:tags', [...props.tags, tag]);
  inputValue.value = '';
  focused.value = false;
}
</script>

<style scoped>
.session-tag-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: #93c5fd;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 999px;
  padding: 1px 5px;
}

.tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  width: 12px;
  height: 12px;
}

.tag-input-wrap {
  position: relative;
  min-width: 80px;
  flex: 1 1 auto;
}

.tag-input {
  width: 100%;
  background: #0b1320;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 11px;
  padding: 3px 6px;
  outline: none;
}

.tag-input:focus {
  border-color: #64748b;
}

.tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 130;
  margin-top: 4px;
  background: #0b1320;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 120px;
}

.tag-suggestion {
  background: transparent;
  border: none;
  color: #e2e8f0;
  font-size: 11px;
  text-align: left;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
}

.tag-suggestion:hover {
  background: rgba(30, 41, 59, 0.8);
}
</style>
