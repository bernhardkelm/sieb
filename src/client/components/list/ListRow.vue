<script setup lang="ts">
import { computed, inject } from 'vue'

import { LIST_KIND } from '@/components/list/listKind'

const props = withDefaults(
  defineProps<{
    /** Row under the keyboard cursor, the one focus lands on */
    current?: boolean
    /** Row checked for a bulk action */
    checked?: boolean
  }>(),
  { current: false, checked: false },
)

const treegrid = inject(LIST_KIND, 'listbox') === 'treegrid'

const selected = computed(() => (treegrid ? props.current : props.checked))
</script>

<template>
  <li
    class="list-row"
    :class="{ current, checked }"
    :role="treegrid ? 'row' : 'option'"
    :aria-selected="selected"
    :aria-level="treegrid ? 1 : undefined"
    :tabindex="current ? 0 : -1"
  >
    <span class="cells" :role="treegrid ? 'gridcell' : undefined">
      <slot />
    </span>
  </li>
</template>

<style scoped>
.list-row {
  display: flex;
  align-items: center;
  height: var(--row-height);
  padding: 0 var(--space-4);
  border-bottom: var(--border-width) solid var(--color-border);
  cursor: default;
  scroll-margin-block: calc(var(--row-height) * 2);
}

.cells {
  display: grid;
  flex: 1;
  grid-template-columns: var(--row-columns, 1fr);
  align-items: center;
  column-gap: var(--space-3);
  min-width: 0;
}

.list-row:hover {
  background: var(--color-hover);
}

.checked {
  background: var(--color-checked);
}

.current {
  background: var(--color-selected);
  box-shadow: inset var(--border-width-strong) 0 0 var(--color-accent);
}

.list-row:focus-visible {
  outline-offset: calc(-1 * var(--border-width-strong));
}

/* two lines in narrow lists: cells with order 2 wrap below the break */
@container (max-width: 640px) {
  .list-row {
    height: auto;
    min-height: var(--touch-target);
    padding-block: var(--space-2);
  }

  .cells {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-2);
  }

  .cells::after {
    content: '';
    flex-basis: 100%;
    order: 1;
  }
}
</style>
