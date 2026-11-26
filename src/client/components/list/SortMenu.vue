<script setup lang="ts" generic="C extends string">
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { computed } from 'vue'

import type { SortDirection, SortState } from '@/components/list/listSort'

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

const emit = defineEmits<{ change: [sort: SortState<C> | null] }>()

const DEFAULT_ORDER = 'default'

const DIRECTIONS: { value: SortDirection; label: string }[] = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
]

const ids = computed(() =>
  (Object.keys(props.columns) as C[]).filter((id) => !props.hidden.includes(id)),
)

/**
 * Sorts by a picked column, keeping the direction when the column stays.
 * @param {unknown} value - Column id, or the default order entry
 * @returns {void}
 */
const onColumn = (value: unknown): void => {
  const column = ids.value.find((id) => id === value)

  if (column === undefined) {
    emit('change', null)
    return
  }

  emit('change', {
    column,
    direction: props.sort?.column === column ? props.sort.direction : props.columns[column].first,
  })
}

/**
 * Changes the direction of the sorted column.
 * @param {unknown} value - Picked direction
 * @returns {void}
 */
const onDirection = (value: unknown): void => {
  const direction = DIRECTIONS.find((option) => option.value === value)?.value

  if (props.sort !== null && direction !== undefined) {
    emit('change', { column: props.sort.column, direction })
  }
}

/**
 * Keeps the menu open after a pick, so column and direction can be set in one go.
 * @param {Event} event - Select event of the item
 * @returns {void}
 */
const keepOpen = (event: Event): void => {
  event.preventDefault()
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="sort-menu" :class="{ active: sort !== null }">
      Sort
      <span v-if="sort !== null" class="summary">
        {{ columns[sort.column].label }}
        <svg
          class="arrow"
          :class="sort.direction"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" />
        </svg>
        <span class="visually-hidden">{{
          sort.direction === 'asc' ? 'ascending' : 'descending'
        }}</span>
      </span>
      <svg class="caret" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M4.5 6.5 8 10l3.5-3.5" />
      </svg>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <!-- as-child renders the surface from this template, Reka moves class attrs off its scoped root -->
      <DropdownMenuContent as-child align="start" :side-offset="4" :collision-padding="8">
        <div class="content">
          <DropdownMenuLabel class="heading">Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            :model-value="sort?.column ?? DEFAULT_ORDER"
            @update:model-value="onColumn"
          >
            <DropdownMenuRadioItem :value="DEFAULT_ORDER" class="item" @select="keepOpen">
              <DropdownMenuItemIndicator class="check" force-mount>
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                </svg>
              </DropdownMenuItemIndicator>
              Default order
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem
              v-for="id in ids"
              :key="id"
              :value="id"
              class="item"
              @select="keepOpen"
            >
              <DropdownMenuItemIndicator class="check" force-mount>
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                </svg>
              </DropdownMenuItemIndicator>
              {{ columns[id].label }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator class="separator" />
          <DropdownMenuLabel class="heading">Direction</DropdownMenuLabel>
          <DropdownMenuRadioGroup :model-value="sort?.direction" @update:model-value="onDirection">
            <DropdownMenuRadioItem
              v-for="option in DIRECTIONS"
              :key="option.value"
              :value="option.value"
              :disabled="sort === null"
              class="item"
              @select="keepOpen"
            >
              <DropdownMenuItemIndicator class="check" force-mount>
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                </svg>
              </DropdownMenuItemIndicator>
              {{ option.label }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style scoped>
/* wide lists sort from their column headers */
.sort-menu {
  display: none;
  flex: none;
  align-items: center;
  gap: var(--space-1);
  height: var(--control-height);
  padding: 0 var(--space-2);
  border: var(--border-width) dashed var(--color-border-strong);
  border-radius: var(--radius);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

@media (max-width: 639px) {
  .sort-menu {
    display: inline-flex;
  }
}

.sort-menu:hover,
.sort-menu[aria-expanded='true'] {
  background: var(--color-hover);
  color: var(--color-text);
}

.active {
  border-style: solid;
  color: var(--color-text);
}

.summary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-0-5);
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--color-selected);
  font-weight: var(--font-weight-medium);
}

.arrow,
.caret {
  width: var(--icon-size);
  height: var(--icon-size);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.arrow {
  width: var(--chevron-size);
  height: var(--chevron-size);
}

.arrow.asc {
  transform: rotate(180deg);
}

.content {
  z-index: var(--z-menu);
  display: flex;
  flex-direction: column;
  min-width: var(--popover-min-width);
  max-width: calc(100vw - 2 * var(--space-2));
  max-height: var(--reka-dropdown-menu-content-available-height);
  padding: var(--space-1);
  overflow-y: auto;
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
  color: var(--color-text);
}

.heading {
  padding: var(--space-1-5) var(--space-2) var(--space-1);
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  outline: none;
  cursor: pointer;
}

.item[data-highlighted] {
  background: var(--color-hover);
}

.item[data-disabled] {
  color: var(--color-text-subtle);
  cursor: default;
}

.check {
  display: inline-grid;
  flex: none;
  width: var(--icon-size);
  height: var(--icon-size);
  visibility: hidden;
}

.check[data-state='checked'] {
  visibility: visible;
}

.check svg {
  width: var(--icon-size);
  height: var(--icon-size);
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.separator {
  height: var(--border-width);
  margin: var(--space-1) 0;
  background: var(--color-border);
}
</style>
