<script setup lang="ts">
import { computed } from 'vue'

import type { CveAggregate } from '#core/cveAggregation.ts'
import ListSummary from '@/components/list/ListSummary.vue'
import { countOf } from '@/format/count'

const props = defineProps<{
  /** CVEs passing the filters */
  cves: CveAggregate[]
  total: number
  /** CVEs left out because all their open findings are decided */
  hidden: number
  /** Active custom sort, null for the default order */
  sortLabel: string | null
}>()

defineEmits<{ resetSort: [] }>()

const kev = computed(() => props.cves.filter((cve) => cve.kev).length)
const undecided = computed(() => props.cves.filter((cve) => cve.inboxCount > 0).length)
</script>

<template>
  <ListSummary :sort-label="sortLabel" @reset-sort="$emit('resetSort')">
    <span>{{
      cves.length === total ? countOf(total, 'CVE') : `${cves.length} of ${countOf(total, 'CVE')}`
    }}</span>
    <span v-if="kev > 0"> · {{ kev }} KEV listed</span>
    <span> · {{ undecided }} with undecided images</span>
    <span v-if="hidden > 0"> · {{ hidden }} hidden as fully decided</span>
  </ListSummary>
</template>
