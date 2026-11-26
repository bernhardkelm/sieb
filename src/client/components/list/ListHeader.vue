<script setup lang="ts">
import { inject } from 'vue'

import { LIST_KIND } from '@/components/list/listKind'

defineProps<{
  /** Names the header table of a list that cannot own header rows, such as a listbox */
  label?: string
}>()

const treegrid = inject(LIST_KIND, null) === 'treegrid'
</script>

<template>
  <li v-if="treegrid" class="list-header" role="row">
    <slot />
  </li>
  <div v-else class="list-header-table" role="table" :aria-label="label">
    <div class="list-header" role="row">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.list-header {
  display: grid;
  grid-template-columns: var(--row-columns, 1fr);
  align-items: center;
  column-gap: var(--space-3);
  height: var(--row-height);
  padding: 0 var(--space-4);
  border-bottom: var(--border-width) solid var(--color-border);
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
  white-space: nowrap;
}

/* narrow lists sort from the toolbar menu instead */
@container (max-width: 640px) {
  .list-header,
  .list-header-table {
    display: none;
  }
}
</style>
