<script setup lang="ts">
import { computed } from 'vue'

import { AUTO_CHECK_SHORTCUT, usePanelAutoCheck } from '@/composables/usePanelAutoCheck'
import { useChecksStore } from '@/stores/checksStore'

const checks = useChecksStore()
const { blockedBy, submitting, run } = usePanelAutoCheck()

const blocked = computed(() => blockedBy.value !== null || submitting.value)
const title = computed(
  () =>
    blockedBy.value ??
    `Queue a headless Claude check of this finding, it files a proposal (${AUTO_CHECK_SHORTCUT})`,
)
</script>

<template>
  <button
    v-if="checks.enabled"
    type="button"
    class="auto-check-button"
    :aria-disabled="blocked || undefined"
    :aria-busy="submitting || undefined"
    :tabindex="blocked ? -1 : undefined"
    :title="title"
    :aria-keyshortcuts="AUTO_CHECK_SHORTCUT"
    @click="run()"
  >
    <svg class="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14M5 7l1.5 1.5L9.5 5.5" />
    </svg>
    <span class="visually-hidden">Auto-check</span>
  </button>
</template>

<style scoped>
.auto-check-button {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-width: var(--control-height);
  height: var(--control-height);
  padding: 0;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  transition:
    background-color var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

.auto-check-button:hover:not([aria-disabled='true']) {
  background: var(--color-hover);
  color: var(--color-text);
}

.auto-check-button[aria-disabled='true'] {
  cursor: default;
  opacity: 0.55;
}

.icon {
  flex: none;
  width: var(--icon-size);
  height: var(--icon-size);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (hover: none) and (pointer: coarse), (max-width: 639px) {
  .auto-check-button {
    min-width: var(--touch-target);
    height: var(--touch-target);
  }
}
</style>
