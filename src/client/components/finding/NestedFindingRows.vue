<script setup lang="ts">
import type { FindingView } from '#core/findingView.ts'
import FindingRow from '@/components/finding/FindingRow.vue'
import NestedPanel from '@/components/list/NestedPanel.vue'
import { useNow } from '@/composables/useNow'
import { findingRowKey } from '@/keyboard/rowKey'
import { isNewFinding } from '@/stores/findingFilters'

defineProps<{
  findings: FindingView[]
  currentKey: string | null
  /** Whether the findings store has loaded, shows a loading row before */
  loaded: boolean
}>()

defineEmits<{ select: [key: string] }>()

const now = useNow()
</script>

<template>
  <NestedPanel v-if="!loaded">Loading findings…</NestedPanel>
  <NestedPanel v-else-if="findings.length === 0">No open findings.</NestedPanel>
  <FindingRow
    v-for="finding in findings"
    :key="finding.id"
    class="nested"
    :finding="finding"
    :current="currentKey === findingRowKey(finding.id)"
    :checked="false"
    :is-new="isNewFinding(finding.firstSeen, now)"
    :selectable="false"
    show-decision
    :data-row-key="findingRowKey(finding.id)"
    aria-level="2"
    @click="$emit('select', findingRowKey(finding.id))"
  />
</template>

<style scoped>
.nested.list-row {
  padding-left: calc(var(--space-4) + var(--nested-indent));
}

@container (max-width: 640px) {
  .nested.list-row {
    padding-left: calc(var(--space-4) + var(--chevron-size));
  }
}
</style>
