<script setup lang="ts">
import type { ChipTone } from '@/components/chips/chipTone'

withDefaults(
  defineProps<{
    tone?: ChipTone
    /** Shows a coloured dot before the label instead of tinting the background */
    dot?: boolean
    /** Leaves out the background, for chips that should stay quiet */
    outline?: boolean
  }>(),
  { tone: 'neutral', dot: false, outline: false },
)
</script>

<template>
  <span class="chip" :class="[tone, { dot, outline }]">
    <span v-if="dot" class="marker" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.chip {
  --chip-color: var(--color-text-muted);
  --chip-wash: var(--color-severity-unknown-wash);
  --chip-ink: var(--chip-color);

  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-1);
  height: var(--chip-height);
  padding: 0 var(--space-1-5);
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-sm);
  background: var(--chip-wash);
  color: var(--chip-ink);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  white-space: nowrap;
}

.outline {
  border-color: var(--color-border);
  background: transparent;
}

.dot {
  background: transparent;
  color: var(--color-text);
}

.marker {
  width: var(--dot-size);
  height: var(--dot-size);
  border-radius: var(--radius-pill);
  background: var(--chip-color);
}

.critical {
  --chip-color: var(--color-severity-critical);
  --chip-wash: var(--color-severity-critical-wash);
  --chip-ink: var(--color-severity-critical-text);
}

.high {
  --chip-color: var(--color-severity-high);
  --chip-wash: var(--color-severity-high-wash);
  --chip-ink: var(--color-severity-high-text);
}

.medium {
  --chip-color: var(--color-severity-medium);
  --chip-wash: var(--color-severity-medium-wash);
  --chip-ink: var(--color-severity-medium-text);
}

.low {
  --chip-color: var(--color-severity-low);
  --chip-wash: var(--color-severity-low-wash);
  --chip-ink: var(--color-severity-low-text);
}

.kev {
  --chip-color: var(--color-kev);
  --chip-wash: var(--color-kev-wash);
}

.accent {
  --chip-color: var(--color-accent);
  --chip-wash: var(--color-accent-wash);
}

.success {
  --chip-color: var(--color-success);
  --chip-wash: var(--color-success-wash);
}

.warning {
  --chip-color: var(--color-warning);
  --chip-wash: var(--color-warning-wash);
}

.danger {
  --chip-color: var(--color-danger);
  --chip-wash: var(--color-danger-wash);
}
</style>
