<template>
  <dialog
    ref="dialogRef"
    class="modal-backdrop"
    @close="$emit('close')"
    @cancel.prevent
    @click.self="dialogRef?.close()"
  >
    <div class="modal">
      <header class="modal-header">
        <div class="modal-title">Analytics</div>
        <button type="button" class="modal-close-button" @click="dialogRef?.close()">
          <Icon icon="lucide:x" :width="14" :height="14" />
        </button>
      </header>
      <div class="modal-body">
        <div v-if="!hasData" class="empty-state">No usage data recorded yet.</div>
        <template v-else>
          <div class="section">
            <div class="section-title">Session usage</div>
            <div class="token-bar-wrap">
              <div class="token-bar-labels">
                <span class="token-label input">Input {{ formatNumber(sessionUsage?.totalInput ?? 0) }}</span>
                <span class="token-label output">Output {{ formatNumber(sessionUsage?.totalOutput ?? 0) }}</span>
                <span v-if="contextLimit && contextLimit > 0" class="token-label limit">Limit {{ formatNumber(contextLimit) }}</span>
              </div>
              <div class="token-bar-track">
                <div
                  class="token-bar-segment input-seg"
                  :style="{ width: `${inputPercent}%` }"
                />
                <div
                  class="token-bar-segment output-seg"
                  :style="{ width: `${outputPercent}%` }"
                />
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Usage over time</div>
            <div class="chart-wrap">
              <svg
                v-if="chartPoints.length > 0"
                class="chart-svg"
                viewBox="0 0 100 40"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.5" />
                    <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.05" />
                  </linearGradient>
                </defs>
                <polygon :points="areaPoints" fill="url(#chartGradient)" />
                <polyline :points="linePoints" fill="none" stroke="#3b82f6" stroke-width="0.4" vector-effect="non-scaling-stroke" />
              </svg>
              <div v-else class="empty-chart">No complete messages yet</div>
            </div>
            <div class="chart-legend">
              <span class="legend-dot total" /> Total tokens per message
            </div>
          </div>

          <div class="section">
            <div class="section-title">Project totals</div>
            <div class="stats-grid">
              <div class="stat">
                <div class="stat-value">{{ formatNumber(projectUsage.totalInput) }}</div>
                <div class="stat-label">Input</div>
              </div>
              <div class="stat">
                <div class="stat-value">{{ formatNumber(projectUsage.totalOutput) }}</div>
                <div class="stat-label">Output</div>
              </div>
              <div class="stat">
                <div class="stat-value">{{ formatNumber(projectUsage.totalReasoning) }}</div>
                <div class="stat-label">Reasoning</div>
              </div>
              <div class="stat">
                <div class="stat-value">{{ formatCurrency(projectUsage.estimatedCost) }}</div>
                <div class="stat-label">Est. cost</div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useAnalytics } from '../composables/useAnalytics';

const props = defineProps<{
  open: boolean;
  sessionId: string;
  projectId: string;
  contextLimit?: number | null;
}>();

defineEmits<{
  (event: 'close'): void;
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
const { getSessionUsage, getProjectUsage } = useAnalytics();

watch(
  () => props.open,
  (open) => {
    const el = dialogRef.value;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  },
);

const sessionUsage = computed(() => getSessionUsage(props.sessionId));
const projectUsage = computed(() => getProjectUsage(props.projectId));
const hasData = computed(() => projectUsage.value.sessionCount > 0);

const limitForBar = computed(() => {
  const limit = props.contextLimit;
  if (limit && Number.isFinite(limit) && limit > 0) return limit;
  const max = Math.max(
    sessionUsage.value?.totalInput ?? 0,
    sessionUsage.value?.totalOutput ?? 0,
    1,
  );
  return max;
});

const inputPercent = computed(() => {
  const val = sessionUsage.value?.totalInput ?? 0;
  return Math.min(100, Math.round((val / limitForBar.value) * 100));
});

const outputPercent = computed(() => {
  const base = sessionUsage.value?.totalInput ?? 0;
  const val = sessionUsage.value?.totalOutput ?? 0;
  const remaining = Math.max(0, limitForBar.value - base);
  if (remaining <= 0) return 0;
  return Math.min(100, Math.round((val / limitForBar.value) * 100));
});

const chartPoints = computed(() => {
  const snaps = sessionUsage.value?.snapshots ?? [];
  if (snaps.length === 0) return [];
  return snaps.map((s, index) => ({ index, total: s.total }));
});

const linePoints = computed(() => {
  const pts = chartPoints.value;
  if (pts.length === 0) return '';
  const maxTotal = Math.max(...pts.map((p) => p.total), 1);
  const stepX = 100 / Math.max(pts.length - 1, 1);
  return pts
    .map((p, i) => {
      const x = i * stepX;
      const y = 40 - (p.total / maxTotal) * 36 - 2;
      return `${x},${y}`;
    })
    .join(' ');
});

const areaPoints = computed(() => {
  const pts = chartPoints.value;
  if (pts.length === 0) return '';
  const maxTotal = Math.max(...pts.map((p) => p.total), 1);
  const stepX = 100 / Math.max(pts.length - 1, 1);
  const coords = pts.map((p, i) => {
    const x = i * stepX;
    const y = 40 - (p.total / maxTotal) * 36 - 2;
    return `${x},${y}`;
  });
  return `${coords.join(' ')} 100,40 0,40`;
});

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatCurrency(n: number): string {
  return `$${n.toFixed(4)}`;
}
</script>

<style scoped>
.modal-backdrop {
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  color: inherit;
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-backdrop:not([open]) {
  display: none;
}

.modal-backdrop::backdrop {
  background: rgba(2, 6, 23, 0.65);
}

.modal {
  width: min(560px, 95vw);
  max-height: min(720px, 90vh);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid #334155;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(2, 6, 23, 0.45);
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.modal-title {
  font-size: 14px;
  font-weight: 600;
}

.modal-close-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #334155;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.modal-close-button:hover {
  background: #1e293b;
  color: #e2e8f0;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 8px;
}

.token-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.token-bar-labels {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
}

.token-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.token-label.input::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #60a5fa;
}

.token-label.output::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #34d399;
}

.token-label.limit {
  margin-left: auto;
  color: #64748b;
}

.token-bar-track {
  height: 10px;
  background: rgba(30, 41, 59, 0.8);
  border-radius: 5px;
  overflow: hidden;
  display: flex;
}

.token-bar-segment {
  height: 100%;
  transition: width 0.3s ease;
}

.input-seg {
  background: #60a5fa;
}

.output-seg {
  background: #34d399;
}

.chart-wrap {
  height: 140px;
  background: rgba(2, 6, 23, 0.45);
  border: 1px solid #1e293b;
  border-radius: 8px;
  overflow: hidden;
}

.chart-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.empty-chart {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 12px;
}

.chart-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 6px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #3b82f6;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.stat {
  padding: 10px;
  border: 1px solid #1e293b;
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.45);
  text-align: center;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
}

.stat-label {
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

html.theme-light .modal {
  background: rgba(255, 255, 255, 0.98);
  border-color: #cbd5e1;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  color: #0f172a;
}

html.theme-light .modal-backdrop::backdrop {
  background: rgba(15, 23, 42, 0.25);
}

html.theme-light .modal-close-button {
  border-color: #cbd5e1;
  color: #64748b;
}

html.theme-light .modal-close-button:hover {
  background: #f1f5f9;
  color: #0f172a;
}

html.theme-light .empty-state {
  color: #94a3b8;
}

html.theme-light .section-title {
  color: #64748b;
}

html.theme-light .token-bar-track {
  background: rgba(226, 232, 240, 0.9);
}

html.theme-light .chart-wrap {
  background: rgba(248, 250, 252, 0.85);
  border-color: #e2e8f0;
}

html.theme-light .empty-chart {
  color: #94a3b8;
}

html.theme-light .chart-legend {
  color: #64748b;
}

html.theme-light .stat {
  border-color: #e2e8f0;
  background: rgba(248, 250, 252, 0.85);
}

html.theme-light .stat-value {
  color: #0f172a;
}

html.theme-light .stat-label {
  color: #94a3b8;
}
</style>
