<script setup lang="ts">
import { computed, ref } from 'vue'

import type { FilterOption } from '@/components/filters/filterOption'
import {
  emptyAggregateFilters,
  hasAggregateFilters,
  type AggregateFilters,
} from '@/components/filters/aggregateFilters'
import FilterResetButton from '@/components/filters/FilterResetButton.vue'
import { EXPOSURE_OPTIONS, ownerOptions, SEVERITY_OPTIONS } from '@/components/filters/labelOptions'
import MultiSelectFilter from '@/components/filters/MultiSelectFilter.vue'
import SearchInput from '@/components/filters/SearchInput.vue'
import { useLabelsStore } from '@/stores/labelsStore'

type SelectField = 'severity' | 'exposure' | 'owner'

const props = withDefaults(
  defineProps<{
    /** Multi-select filters next to the search in this order, exposure and owner only when present */
    fields: SelectField[]
    placeholder?: string
  }>(),
  { placeholder: 'Search' },
)

const filters = defineModel<AggregateFilters>('filters', { required: true })

const labels = useLabelsStore()

const options = computed<Record<SelectField, { label: string; options: FilterOption<string>[] }>>(
  () => ({
    severity: { label: 'Severity', options: SEVERITY_OPTIONS },
    exposure: { label: 'Exposure', options: EXPOSURE_OPTIONS },
    owner: { label: 'Owner', options: ownerOptions(labels.owners) },
  }),
)

const visibleFields = computed(() =>
  props.fields.filter(
    (field) =>
      (field !== 'exposure' || labels.showExposure) && (field !== 'owner' || labels.showOwner),
  ),
)

const search = ref<InstanceType<typeof SearchInput> | null>(null)

/**
 * Changes one filter.
 * @param {K} key - Filter name
 * @param {AggregateFilters[K]} value - New value
 * @returns {void}
 */
const set = <K extends keyof AggregateFilters>(key: K, value: AggregateFilters[K]): void => {
  filters.value = { ...filters.value, [key]: value }
}

/**
 * Focuses the search input.
 * @returns {void}
 */
const focusSearch = (): void => {
  search.value?.focus()
}

defineExpose({ focusSearch })
</script>

<template>
  <div class="aggregate-filter-bar" role="search">
    <SearchInput
      ref="search"
      :model-value="filters.q"
      :placeholder="placeholder"
      @update:model-value="set('q', $event)"
    />
    <div class="controls">
      <!-- view controls such as the sort menu, first so a scrolling row keeps them in view -->
      <slot />
      <MultiSelectFilter
        v-for="field in visibleFields"
        :key="field"
        :label="options[field].label"
        :options="options[field].options"
        :model-value="filters[field]"
        @update:model-value="set(field, $event as AggregateFilters[typeof field])"
      />
      <FilterResetButton
        v-if="hasAggregateFilters(filters)"
        @click="filters = emptyAggregateFilters()"
      />
    </div>
  </div>
</template>

<style scoped>
.aggregate-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

@media (max-width: 639px) {
  .aggregate-filter-bar {
    flex: 1 1 100%;
    min-width: 0;
  }

  .controls {
    flex: 1 1 100%;
    flex-wrap: nowrap;
    min-width: 0;
    margin: calc(-1 * var(--space-0-5));
    padding: var(--space-0-5);
    overflow-x: auto;
    scrollbar-width: none;
  }
}
</style>
