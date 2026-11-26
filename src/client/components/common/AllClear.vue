<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="all-clear">
    <svg class="illustration" viewBox="30 -2 140 90" aria-hidden="true" focusable="false">
      <path class="sparkle" d="M46 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
      <path class="sparkle small" d="M156 62l1.4 4 4 1.4-4 1.4-1.4 4-1.4-4-4-1.4 4-1.4z" />
      <rect class="tile" x="65" y="8" width="70" height="70" rx="16" />
      <circle class="eye" cx="89" cy="37" r="5" />
      <circle class="eye" cx="111" cy="37" r="5" />
      <path class="smile" d="M87 52q13 12 26 0" pathLength="1" />
    </svg>
    <h2 class="title">{{ title }}</h2>
    <p class="text"><slot /></p>
    <div v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.all-clear {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-12) var(--space-4);
  text-align: center;
}

.illustration {
  width: var(--illustration-width);
  height: auto;
  margin-bottom: var(--space-2);
  overflow: visible;
}

.sparkle {
  fill: var(--color-accent);
  opacity: 0.45;
}

.sparkle.small {
  opacity: 0.3;
}

.tile {
  fill: var(--color-accent-wash);
  stroke: var(--color-accent);
  stroke-width: 2.5;
}

.eye {
  fill: var(--color-accent);
}

.smile {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 4.5;
  stroke-linecap: round;
  animation: smile var(--duration-draw) var(--ease) 120ms backwards;
}

.title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.text {
  max-width: var(--illustration-text-width);
  margin: 0;
  color: var(--color-text-muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-1) var(--space-4);
  margin-top: var(--space-2);
}

/* opacity hides the round cap of the still empty dash */
@keyframes smile {
  from {
    opacity: 0;
    stroke-dasharray: 1 2;
    stroke-dashoffset: 1;
  }

  10% {
    opacity: 1;
  }

  to {
    stroke-dasharray: 1 2;
    stroke-dashoffset: 0;
  }
}

@media (max-width: 639px) {
  .illustration {
    width: var(--illustration-width-sm);
  }
}

@media (prefers-reduced-motion: reduce) {
  .smile {
    animation: none;
  }
}
</style>
