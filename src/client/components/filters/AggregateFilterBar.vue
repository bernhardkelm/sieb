<script setup lang="ts">
import { computed, ref } from 'vue'

import type { FilterOption } from '@/components/filters/filterOption'
import {
  emptyAggregateFilters,
  hasAggregateFilters,
  type AggregateFilters,
  type AggregateToggle,
} from '@/components/filters/aggregateFilters'
import FilterResetButton from '@/components/filters/FilterResetButton.vue'
import { EXPOSURE_OPTIONS, ownerOptions, SEVERITY_OPTIONS } from '@/components/filters/labelOptions'
import MultiSelectFilter from '@/components/filters/MultiSelectFilter.vue'
import SearchInput from '@/components/filters/SearchInput.vue'
import ToggleFilter from '@/components/filters/ToggleFilter.vue'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { useLabelsStore } from '@/stores/labelsStore'

type SelectField = 'severity' | 'exposure' | 'owner'

const props = withDefaults(
  defineProps<{
    /** Multi-select filters next to the search in this order, exposure and owner only when present */
    fields: SelectField[]
    /** Toggles after the multi-selects in this order, with their labels */
    toggles?: Partial<Record<AggregateToggle, string>>
    placeholder?: string
  }>(),
  { toggles: () => ({}), placeholder: 'Search' },
)

const filters = defineModel<AggregateFilters>('filters', { required: true })

const labels = useLabelsStore()
const { hidden } = useLabelColumns()

const options = computed<Record<SelectField, { label: string; options: FilterOption<string>[] }>>(
  () => ({
    severity: { label: 'Severity', options: SEVERITY_OPTIONS },
    exposure: { label: 'Exposure', options: EXPOSURE_OPTIONS },
    owner: { label: 'Owner', options: ownerOptions(labels.owners) },
  }),
)

const visibleToggles = computed(() => Object.entries(props.toggles) as [AggregateToggle, string][])

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
      <!-- view controls such as the sort menu, first -->
      <slot />
      <MultiSelectFilter
        v-for="field in visibleFields"
        :key="field"
        :label="options[field].label"
        :options="options[field].options"
        :model-value="filters[field]"
        @update:model-value="set(field, $event as AggregateFilters[typeof field])"
      />
      <ToggleFilter
        v-for="[toggle, label] in visibleToggles"
        :key="toggle"
        :label="label"
        :model-value="filters[toggle]"
        @update:model-value="set(toggle, $event)"
      />
      <FilterResetButton
        v-if="hasAggregateFilters(filters, hidden)"
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
    min-width: 0;
  }
}
</style>
