<script setup lang="ts">
withDefaults(
  defineProps<{
    value: number
    /** What is counted, read by screen readers after the number */
    label: string
    /** Colours a non-zero count, such as KEV, muted for counts outside the risk */
    tone?: 'default' | 'kev' | 'danger' | 'muted'
  }>(),
  { tone: 'default' },
)
</script>

<template>
  <span class="count-value" :class="[tone, { zero: value === 0 }]">
    <!-- no-break space, a plain leading space collapses inside the hidden label -->
    {{ value }}<span class="visually-hidden label">&nbsp;{{ label }}</span>
  </span>
</template>

<style scoped>
.count-value {
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.kev {
  color: var(--color-kev);
  font-weight: var(--font-weight-semibold);
}

.danger {
  color: var(--color-danger);
  font-weight: var(--font-weight-semibold);
}

.muted {
  color: var(--color-text-subtle);
}

.zero {
  color: var(--color-text-subtle);
  font-weight: var(--font-weight-regular);
  opacity: 0.6;
}

/* narrow lists drop the column headers, the label names the count instead */
@container (max-width: 640px) {
  .label {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    overflow: visible;
    clip-path: none;
    font-weight: var(--font-weight-regular);
  }
}
</style>
