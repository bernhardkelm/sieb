<template>
  <svg class="illustration" viewBox="30 -2 140 90" aria-hidden="true" focusable="false">
    <path class="sparkle" d="M46 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
    <path class="sparkle small" d="M156 62l1.4 4 4 1.4-4 1.4-1.4 4-1.4-4-4-1.4 4-1.4z" />
    <path
      class="tray"
      d="M62 36h22q4 0 5 4l2 6q1 4 5 4h12q4 0 5-4l2-6q1-4 5-4h22v30a10 10 0 0 1-10 10H72a10 10 0 0 1-10-10z"
    />
    <path class="check" d="M92 64l6 6 11-12" pathLength="1" />
  </svg>
</template>

<style scoped>
.sparkle {
  fill: var(--color-accent);
  opacity: 0.45;
}

.sparkle.small {
  opacity: 0.3;
}

.tray {
  fill: var(--color-accent-wash);
  stroke: var(--color-accent);
  stroke-width: 2.5;
  stroke-linejoin: round;
}

.check {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.55;
  animation: check var(--duration-draw) var(--ease) 120ms backwards;
}

/* opacity hides the round cap of the still empty dash */
@keyframes check {
  from {
    opacity: 0;
    stroke-dasharray: 1 2;
    stroke-dashoffset: 1;
  }

  10% {
    opacity: 0.55;
  }

  to {
    stroke-dasharray: 1 2;
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .check {
    animation: none;
  }
}
</style>
