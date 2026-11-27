<script setup lang="ts">
import { computed, ref } from 'vue'

import { INBOX_KINDS, type InboxKind } from '#core/inbox/inboxItem.ts'
import FilterBarShell from '@/components/filters/FilterBarShell.vue'
import type { FilterOption } from '@/components/filters/filterOption'
import FilterResetButton from '@/components/filters/FilterResetButton.vue'
import { EXPOSURE_OPTIONS, ownerOptions, SEVERITY_OPTIONS } from '@/components/filters/labelOptions'
import MultiSelectFilter from '@/components/filters/MultiSelectFilter.vue'
import ToggleFilter from '@/components/filters/ToggleFilter.vue'
import {
  emptyInboxFilters,
  hasInboxFilters,
  type InboxFilters,
} from '@/components/inbox/inboxFilters'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { INBOX_KIND_LABELS } from '@/format/inboxText'
import { useLabelsStore } from '@/stores/labelsStore'

const filters = defineModel<InboxFilters>('filters', { required: true })

const KIND_OPTIONS: FilterOption<InboxKind>[] = INBOX_KINDS.map((value) => ({
  value,
  label: INBOX_KIND_LABELS[value],
}))

const labels = useLabelsStore()
const owners = computed(() => ownerOptions(labels.owners))
const { hidden } = useLabelColumns()

const shell = ref<InstanceType<typeof FilterBarShell> | null>(null)

/**
 * Changes one filter.
 * @param {K} key - Filter name
 * @param {InboxFilters[K]} value - New value
 * @returns {void}
 */
const set = <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]): void => {
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
    label="Search the Inbox"
    placeholder="Search CVE, image, package, namespace"
    @update:q="set('q', $event)"
  >
    <MultiSelectFilter
      label="Kind"
      :options="KIND_OPTIONS"
      :model-value="filters.kind"
      @update:model-value="set('kind', $event)"
    />
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
    <FilterResetButton
      v-if="hasInboxFilters(filters, hidden)"
      @click="filters = emptyInboxFilters()"
    />
  </FilterBarShell>
</template>
