<script setup lang="ts">
import FindingRow from '@/components/finding/FindingRow.vue'
import type { TreeItem } from '@/components/list/flattenTree'
import NestedPanel from '@/components/list/NestedPanel.vue'
import { useNow } from '@/composables/useNow'
import { isNewFinding } from '@/stores/findingFilters'

defineProps<{
  /** Finding row below an expanded group, or the loading or empty note standing in for them */
  item: Extract<TreeItem<unknown>, { kind: 'status' | 'finding' }>
  currentKey: string | null
}>()

defineEmits<{ select: [key: string] }>()

const now = useNow()
</script>

<template>
  <NestedPanel v-if="item.kind === 'status'">{{ item.text }}</NestedPanel>
  <FindingRow
    v-else
    class="nested"
    :finding="item.finding"
    :current="currentKey === item.key"
    :checked="false"
    :is-new="isNewFinding(item.finding.firstSeen, now)"
    :selectable="false"
    show-decision
    :data-row-key="item.key"
    aria-level="2"
    @select="$emit('select', item.key)"
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
