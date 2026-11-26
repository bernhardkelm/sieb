<script setup lang="ts">
import { computed } from 'vue'

import type { ImageAggregate } from '#core/imageAggregation.ts'
import ExposureChip from '@/components/chips/ExposureChip.vue'
import OwnerBadge from '@/components/chips/OwnerBadge.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import ImageName from '@/components/common/ImageName.vue'
import SeverityBreakdown from '@/components/images/SeverityBreakdown.vue'
import CountValue from '@/components/list/CountValue.vue'
import ExpandChevron from '@/components/list/ExpandChevron.vue'
import ListRow from '@/components/list/ListRow.vue'
import { pluralize } from '@/format/count'
import { useLabelsStore } from '@/stores/labelsStore'

const props = defineProps<{
  image: ImageAggregate
  current: boolean
  expanded: boolean
}>()

const labels = useLabelsStore()
const workloadNoun = computed(() => pluralize(props.image.workloadCount, 'workload'))
</script>

<template>
  <ListRow class="image-row" :current="current" :aria-expanded="expanded">
    <ExpandChevron :expanded="expanded" />
    <span class="name"><ImageName :image-ref="image.imageRef" /></span>
    <OwnerBadge v-if="labels.showOwner" class="optional" :owner="image.owner" />
    <span v-if="labels.showExposure" class="exposure">
      <ExposureChip v-if="image.maxExposure" :exposure="image.maxExposure" />
    </span>
    <span class="breakdown"><SeverityBreakdown :by-severity="image.openBySeverity" /></span>
    <CountValue
      v-if="labels.showKev"
      class="tally"
      :value="image.kevCount"
      label="KEV listed"
      tone="kev"
    />
    <CountValue class="open" :value="image.openCount" label="open" />
    <CountValue class="tally" :value="image.inboxCount" label="in the inbox" />
    <CountValue
      class="optional"
      :value="image.notAffectedCount"
      label="not affected"
      tone="muted"
    />
    <CountValue class="optional" :value="image.acceptedCount" label="accepted" />
    <HintTooltip :text="image.workloads.join('\n') || 'No workloads'">
      <span class="workloads optional">
        {{ image.workloadCount }}<span class="visually-hidden">&nbsp;{{ workloadNoun }}</span>
      </span>
    </HintTooltip>
  </ListRow>
</template>

<style scoped>
.name {
  display: block;
  min-width: 0;
  font-weight: var(--font-weight-medium);
}

.workloads {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

@container (max-width: 900px) {
  .optional {
    display: none;
  }
}

@container (max-width: 640px) {
  .name {
    flex: 1 1 0;
    min-width: calc(var(--space-base) * 24);
  }

  .open,
  .exposure:empty {
    display: none;
  }

  .breakdown,
  .tally {
    order: 2;
  }

  .breakdown {
    margin-left: calc(var(--chevron-size) + var(--space-2));
  }
}
</style>
