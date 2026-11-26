<script setup lang="ts">
import { computed, ref } from 'vue'

import FilterResetButton from '@/components/filters/FilterResetButton.vue'
import { EXPOSURE_OPTIONS, ownerOptions, SEVERITY_OPTIONS } from '@/components/filters/labelOptions'
import MultiSelectFilter from '@/components/filters/MultiSelectFilter.vue'
import SearchInput from '@/components/filters/SearchInput.vue'
import ToggleFilter from '@/components/filters/ToggleFilter.vue'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { emptyFilters, hasActiveFilters, type FindingFilters } from '@/stores/findingFilters'
import { useLabelsStore } from '@/stores/labelsStore'

withDefaults(
  defineProps<{
    /** Offers the "show resolved" toggle, lists that never hold resolved findings hide it */
    resolvedToggle?: boolean
  }>(),
  { resolvedToggle: true },
)

const filters = defineModel<FindingFilters>('filters', { required: true })

const labels = useLabelsStore()
const owners = computed(() => ownerOptions(labels.owners))
const { hidden } = useLabelColumns()

const search = ref<InstanceType<typeof SearchInput> | null>(null)

/**
 * Changes one filter.
 * @param {K} key - Filter name
 * @param {FindingFilters[K]} value - New value
 * @returns {void}
 */
const set = <K extends keyof FindingFilters>(key: K, value: FindingFilters[K]): void => {
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
  <div class="filter-bar" role="search">
    <SearchInput
      ref="search"
      :model-value="filters.q"
      label="Search findings"
      placeholder="Search CVE, image, package, workload"
      @update:model-value="set('q', $event)"
    />
    <div class="controls">
      <!-- view controls such as the sort menu, first -->
      <slot />
      <MultiSelectFilter
        label="Severity"
        :options="SEVERITY_OPTIONS"
        :model-value="filters.severity"
        @update:model-value="set('severity', $event)"
      />
      <MultiSelectFilter
        v-if="labels.showExposure"
        label="Exposure"
        :options="EXPOSURE_OPTIONS"
        :model-value="filters.exposure"
        @update:model-value="set('exposure', $event)"
      />
      <MultiSelectFilter
        v-if="labels.showOwner"
        label="Owner"
        :options="owners"
        :model-value="filters.owner"
        @update:model-value="set('owner', $event)"
      />
      <ToggleFilter
        v-if="labels.showKev"
        label="KEV"
        :model-value="filters.kev"
        @update:model-value="set('kev', $event)"
      />
      <ToggleFilter
        label="New this week"
        :model-value="filters.newThisWeek"
        @update:model-value="set('newThisWeek', $event)"
      />
      <ToggleFilter
        v-if="resolvedToggle"
        label="Show resolved"
        :model-value="filters.includeResolved"
        @update:model-value="set('includeResolved', $event)"
      />
      <FilterResetButton
        v-if="hasActiveFilters(filters, hidden)"
        @click="filters = emptyFilters()"
      />
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
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
  .filter-bar {
    flex: 1 1 100%;
    min-width: 0;
  }

  .controls {
    flex: 1 1 100%;
    min-width: 0;
  }
}
</style>
