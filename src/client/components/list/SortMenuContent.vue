<script setup lang="ts" generic="C extends string">
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from 'reka-ui'

import AppIcon from '@/components/icons/AppIcon.vue'
import type { SortDirection, SortState } from '@/components/list/listSort'

const props = defineProps<{
  /** Sortable columns, with the direction a newly picked column starts in */
  columns: Readonly<Record<C, { label: string; first: SortDirection }>>
  /** Column ids the menu lists, in menu order */
  ids: readonly C[]
  sort: SortState<C> | null
}>()

const emit = defineEmits<{ change: [sort: SortState<C> | null] }>()

const DEFAULT_ORDER = 'default'

const DIRECTIONS: { value: SortDirection; label: string }[] = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
]

/**
 * Sorts by a picked column, keeping the direction when the column stays.
 * @param {unknown} value - Column id, or the default order entry
 * @returns {void}
 */
const onColumn = (value: unknown): void => {
  const column = props.ids.find((id) => id === value)

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
  <DropdownMenuPortal>
    <!-- as-child renders the surface from this template, Reka moves class attrs off its scoped root -->
    <DropdownMenuContent as-child align="start" :side-offset="4" :collision-padding="8">
      <div class="menu-content content">
        <DropdownMenuLabel class="heading caps-label">Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          :model-value="sort?.column ?? DEFAULT_ORDER"
          @update:model-value="onColumn"
        >
          <DropdownMenuRadioItem :value="DEFAULT_ORDER" class="item" @select="keepOpen">
            <DropdownMenuItemIndicator class="check" force-mount>
              <AppIcon class="check-icon" name="check" />
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
              <AppIcon class="check-icon" name="check" />
            </DropdownMenuItemIndicator>
            {{ columns[id].label }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator class="separator" />
        <DropdownMenuLabel class="heading caps-label">Direction</DropdownMenuLabel>
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
              <AppIcon class="check-icon" name="check" />
            </DropdownMenuItemIndicator>
            {{ option.label }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </div>
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>

<style scoped src="@/components/filters/menuPopover.css"></style>

<style scoped src="@/components/list/sortMenuContent.css"></style>
