<template>
  <div class="view-toolbar">
    <slot />
  </div>
</template>

<style scoped>
.view-toolbar {
  position: sticky;
  top: var(--topbar-height);
  z-index: var(--z-sticky);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-bottom: var(--border-width) solid var(--color-border);
  background: var(--color-surface);
}

@media (max-width: 639px) {
  .view-toolbar {
    position: static;
    padding: var(--space-2) var(--space-3);
  }
}
</style>
