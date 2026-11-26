<template>
  <li class="nested-panel" role="row" aria-level="2">
    <div class="cell" role="gridcell">
      <slot />
    </div>
  </li>
</template>

<style scoped>
.nested-panel {
  padding: var(--space-2) var(--space-4) var(--space-2) calc(var(--space-4) + var(--nested-indent));
  border-bottom: var(--border-width) solid var(--color-border);
  background: var(--color-page);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

@container (max-width: 640px) {
  .nested-panel {
    padding-left: calc(var(--space-4) + var(--chevron-size));
  }
}

.cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
