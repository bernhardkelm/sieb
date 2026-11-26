<script setup lang="ts">
import { computed } from 'vue'

import type { CveAggregate } from '#core/cveAggregation.ts'
import ExposureChip from '@/components/chips/ExposureChip.vue'
import KevChip from '@/components/chips/KevChip.vue'
import SeverityChip from '@/components/chips/SeverityChip.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import AllScopeChip from '@/components/cves/AllScopeChip.vue'
import CountValue from '@/components/list/CountValue.vue'
import ExpandChevron from '@/components/list/ExpandChevron.vue'
import ListRow from '@/components/list/ListRow.vue'
import { pluralize } from '@/format/count'
import { useLabelsStore } from '@/stores/labelsStore'

const props = defineProps<{
  cve: CveAggregate
  current: boolean
  expanded: boolean
  /** How its open findings are decided, such as "3 accepted, 1 undecided" */
  summary: string
}>()

defineEmits<{ select: [event: MouseEvent] }>()

const labels = useLabelsStore()
const images = computed(() => props.cve.imageRefs.join('\n'))
</script>

<template>
  <ListRow
    class="cve-row"
    :current="current"
    :aria-expanded="expanded"
    @click="$emit('select', $event)"
  >
    <ExpandChevron :expanded="expanded" />
    <SeverityChip :severity="cve.maxSeverity" :score="cve.maxScore" />
    <span v-if="labels.showKev" class="kev"><KevChip v-if="cve.kev" /></span>
    <span class="vuln-id" data-panel-clip>{{ cve.vulnId }}</span>
    <span class="title" data-panel-clip>{{ cve.title ?? '' }}</span>
    <HintTooltip :text="images">
      <CountValue :value="cve.imageCount" :label="pluralize(cve.imageCount, 'image')" />
    </HintTooltip>
    <span v-if="labels.showExposure" class="optional">
      <ExposureChip v-if="cve.maxExposure" :exposure="cve.maxExposure" />
    </span>
    <CountValue class="open" :value="cve.openCount" label="open" />
    <CountValue class="inbox" :value="cve.inboxCount" label="to triage" />
    <span class="decisions">
      <AllScopeChip v-if="cve.allScopeDecision" :decision="cve.allScopeDecision" />
      <span class="summary">{{ summary }}</span>
    </span>
  </ListRow>
</template>

<style scoped>
.vuln-id {
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title,
.summary {
  overflow: hidden;
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.decisions {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  min-width: 0;
  font-size: var(--font-size-sm);
}

@container (max-width: 900px) {
  .title,
  .optional {
    display: none;
  }
}

@container (max-width: 640px) {
  .kev:empty,
  .open {
    display: none;
  }

  .vuln-id {
    flex: 1 1 0;
    min-width: calc(var(--space-base) * 24);
  }

  .title,
  .decisions {
    order: 2;
  }

  .inbox {
    order: 3;
  }

  .title,
  .decisions {
    margin-left: calc(var(--chevron-size) + var(--space-2));
  }

  .title {
    display: block;
    flex: 1 1 100%;
    min-width: 0;
    font-size: var(--font-size-sm);
  }

  .title:empty {
    display: none;
  }

  .decisions {
    flex: 1 1 0;
  }
}
</style>
