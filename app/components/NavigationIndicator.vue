<template>
  <Transition name="nav-fade">
    <div v-if="visible" class="navigation-indicator">
      <div class="nav-indicator-row nav-indicator-up-row">
        <div class="nav-indicator-item nav-up">
          <Icon icon="lucide:arrow-up" :width="24" :height="24" />
          <span class="nav-indicator-label">{{ upLabel }}</span>
        </div>
      </div>
      <div class="nav-indicator-row">
        <div class="nav-indicator-item nav-left">
          <Icon icon="lucide:arrow-left" :width="24" :height="24" />
          <span class="nav-indicator-label">{{ leftLabel }}</span>
        </div>
        <div class="nav-indicator-center">
          {{ centerLabel }}
        </div>
        <div class="nav-indicator-item nav-right">
          <Icon icon="lucide:arrow-right" :width="24" :height="24" />
          <span class="nav-indicator-label">{{ rightLabel }}</span>
        </div>
      </div>
      <div class="nav-indicator-row nav-indicator-down-row">
        <div class="nav-indicator-item nav-down">
          <Icon icon="lucide:arrow-down" :width="24" :height="24" />
          <span class="nav-indicator-label">{{ downLabel }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
  visible: boolean;
  upLabel: string;
  downLabel: string;
  leftLabel: string;
  rightLabel: string;
  centerLabel: string;
}>();
</script>

<style scoped>
.navigation-indicator {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  pointer-events: none;
  user-select: none;
}

.nav-indicator-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.nav-indicator-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 12px;
  background: rgb(15, 23, 42);
  border: 1px solid rgb(71, 85, 105);
  color: #f1f5f9;
  max-width: 320px;
}

.nav-indicator-center {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border-radius: 12px;
  background: rgb(30, 58, 138);
  border: 1px solid rgb(96, 165, 250);
  color: #dbeafe;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
  max-width: 320px;
}

.nav-indicator-label {
  font-size: 13px;
  font-weight: 500;
  color: #f8fafc;
  line-height: 1.25;
}

.nav-indicator-up-row,
.nav-indicator-down-row {
  justify-content: center;
}

html.theme-light .nav-indicator-item {
  background: rgb(255, 255, 255);
  border-color: rgb(203, 213, 225);
  color: #1e293b;
}

html.theme-light .nav-indicator-center {
  background: rgb(219, 234, 254);
  border-color: rgb(96, 165, 250);
  color: #1e40af;
}

html.theme-light .nav-indicator-label {
  color: #0f172a;
}

.nav-fade-enter-active,
.nav-fade-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}

.nav-fade-enter-from,
.nav-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) translateY(-6px);
}
</style>
