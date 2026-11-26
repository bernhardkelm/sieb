<template>
  <span class="loading-spinner" aria-hidden="true" />
</template>

<style scoped>
.loading-spinner {
  display: inline-block;
  flex: none;
  width: var(--spinner-size);
  height: var(--spinner-size);
  border: var(--border-width-strong) solid var(--color-border-strong);
  border-top-color: var(--color-accent);
  border-radius: var(--radius-pill);
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
    border-top-color: var(--color-border-strong);
    border-right-color: var(--color-accent);
  }
}
</style>
