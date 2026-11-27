<script setup lang="ts" generic="C extends string">
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import type { SortDirection, SortState } from '@/components/list/listSort'
import SortMenuContent from '@/components/list/SortMenuContent.vue'

const props = withDefaults(
  defineProps<{
    /** Sortable columns in menu order, with the direction a newly picked column starts in */
    columns: Readonly<Record<C, { label: string; first: SortDirection }>>
    sort: SortState<C> | null
    /** Column ids left out of the menu, such as label columns the list hides */
    hidden?: readonly string[]
  }>(),
  { hidden: () => [] },
)

defineEmits<{ change: [sort: SortState<C> | null] }>()

const ids = computed(() =>
  (Object.keys(props.columns) as C[]).filter((id) => !props.hidden.includes(id)),
)
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="menu-trigger sort-menu" :class="{ active: sort !== null }">
      Sort
      <span v-if="sort !== null" class="menu-summary summary">
        {{ columns[sort.column].label }}
        <AppIcon class="arrow" :class="sort.direction" name="arrow" />
        <span class="visually-hidden">{{
          sort.direction === 'asc' ? 'ascending' : 'descending'
        }}</span>
      </span>
      <AppIcon class="caret" name="chevron-down" />
    </DropdownMenuTrigger>
    <SortMenuContent :columns="columns" :ids="ids" :sort="sort" @change="$emit('change', $event)" />
  </DropdownMenuRoot>
</template>

<style scoped src="@/components/filters/menuPopover.css"></style>

<style scoped>
/* wide lists sort from their column headers */
.sort-menu {
  display: none;
  flex: none;
}

@media (max-width: 639px) {
  .sort-menu {
    display: inline-flex;
  }
}

.summary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-0-5);
}

.arrow {
  --icon-size: var(--chevron-size);
}

.arrow.asc {
  transform: rotate(180deg);
}
</style>
