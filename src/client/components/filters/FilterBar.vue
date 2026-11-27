<script setup lang="ts">
import { computed, ref } from 'vue'

import FilterBarShell from '@/components/filters/FilterBarShell.vue'
import FilterResetButton from '@/components/filters/FilterResetButton.vue'
import {
  EXPOSURE_OPTIONS,
  ownerOptions,
  pendingOptions,
  SEVERITY_OPTIONS,
} from '@/components/filters/labelOptions'
import MultiSelectFilter from '@/components/filters/MultiSelectFilter.vue'
import ToggleFilter from '@/components/filters/ToggleFilter.vue'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { useChecksStore } from '@/stores/checksStore'
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
const checks = useChecksStore()
const pending = computed(() => pendingOptions(checks.enabled))
const { hidden } = useLabelColumns()

const shell = ref<InstanceType<typeof FilterBarShell> | null>(null)

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
  shell.value?.focusSearch()
}

defineExpose({ focusSearch })
</script>

<template>
  <FilterBarShell
    ref="shell"
    :q="filters.q"
    label="Search findings"
    placeholder="Search CVE, image, package, workload"
    @update:q="set('q', $event)"
  >
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
    <MultiSelectFilter
      label="Pending"
      :options="pending"
      :model-value="filters.pending"
      @update:model-value="set('pending', $event)"
    />
    <ToggleFilter
      v-if="labels.showKev"
      label="KEV"
      :model-value="filters.kev"
      @update:model-value="set('kev', $event)"
    />
    <ToggleFilter
      label="Waiting for upstream"
      :model-value="filters.upstreamPending"
      @update:model-value="set('upstreamPending', $event)"
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
    <FilterResetButton v-if="hasActiveFilters(filters, hidden)" @click="filters = emptyFilters()" />
  </FilterBarShell>
</template>
