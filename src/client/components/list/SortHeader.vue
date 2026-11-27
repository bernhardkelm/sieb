<script setup lang="ts" generic="C extends string">
import { computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import type { SortState } from '@/components/list/listSort'
import { ariaSort } from '@/components/list/sortState'

const props = withDefaults(
  defineProps<{
    column: C
    /** Labels of the sortable columns, the full label names the button */
    columns: Readonly<Record<C, { label: string }>>
    sort: SortState<C> | null
    /** Visible label when the full one does not fit the column */
    short?: string
    /** Aligns the label to the end, for number columns */
    end?: boolean
  }>(),
  { short: undefined, end: false },
)

const emit = defineEmits<{ sort: [column: C] }>()

const direction = computed(() =>
  props.sort?.column === props.column ? props.sort.direction : null,
)
</script>

<template>
  <span
    role="columnheader"
    class="sort-header"
    :class="{ end, active: direction !== null }"
    :aria-sort="ariaSort(sort, column)"
  >
    <button
      type="button"
      class="button"
      :aria-label="short ? columns[column].label : undefined"
      @click="emit('sort', column)"
    >
      {{ short ?? columns[column].label }}
      <AppIcon v-if="direction !== null" class="indicator" :class="direction" name="arrow" />
    </button>
  </span>
</template>

<style scoped>
.sort-header {
  display: flex;
  min-width: 0;
}

.end {
  justify-content: flex-end;
}

.button {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: var(--space-0-5) 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  letter-spacing: inherit;
  text-transform: inherit;
}

.button:hover,
.active .button {
  color: var(--color-text);
}

/* the arrow sits in the column gap outside the label, so a tight column never truncates it */
.indicator {
  --icon-size: var(--sort-indicator-size);

  position: absolute;
  right: 100%;
}

.end .indicator {
  right: auto;
  left: 100%;
}

.asc {
  transform: rotate(180deg);
}
</style>
