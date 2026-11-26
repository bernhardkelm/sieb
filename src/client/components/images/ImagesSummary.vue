<script setup lang="ts">
import { computed } from 'vue'

import type { ImageAggregate } from '#core/imageAggregation.ts'
import ListSummary from '@/components/list/ListSummary.vue'
import { countOf } from '@/format/count'

const props = defineProps<{
  /** Images passing the filters */
  images: ImageAggregate[]
  total: number
  /** Images left out because all their open findings are not affected */
  hidden: number
  /** Active custom sort, null for the default order */
  sortLabel: string | null
}>()

defineEmits<{ resetSort: [] }>()

const own = computed(() => props.images.filter((image) => image.owner === 'self').length)
const kev = computed(() => props.images.filter((image) => image.kevCount > 0).length)
</script>

<template>
  <ListSummary :sort-label="sortLabel" @reset-sort="$emit('resetSort')">
    <span>
      {{
        images.length === total
          ? countOf(total, 'image')
          : `${images.length} of ${countOf(total, 'image')}`
      }}
    </span>
    <span v-if="own > 0"> · {{ own }} own, rebuild those first</span>
    <span v-if="kev > 0"> · {{ kev }} with KEV findings</span>
    <span v-if="hidden > 0"> · {{ hidden }} hidden as not affected</span>
  </ListSummary>
</template>
