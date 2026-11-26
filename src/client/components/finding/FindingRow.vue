<script setup lang="ts">
import type { FindingView } from '#core/findingView.ts'
import DecisionStateChip from '@/components/chips/DecisionStateChip.vue'
import ExposureChip from '@/components/chips/ExposureChip.vue'
import KevChip from '@/components/chips/KevChip.vue'
import OwnerBadge from '@/components/chips/OwnerBadge.vue'
import SeverityChip from '@/components/chips/SeverityChip.vue'
import ImageName from '@/components/common/ImageName.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import ListRow from '@/components/list/ListRow.vue'
import RowCheckbox from '@/components/list/RowCheckbox.vue'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { countOf } from '@/format/count'

withDefaults(
  defineProps<{
    finding: FindingView
    current: boolean
    checked: boolean
    /** First seen within the last seven days */
    isNew: boolean
    /** Shows the checkbox for bulk selection, lists without bulk actions leave its column empty */
    selectable?: boolean
    /** Shows the state of the governing decision instead of the first sighting */
    showDecision?: boolean
  }>(),
  { selectable: true, showDecision: false },
)

defineEmits<{ toggle: [] }>()

const { hidden, classes } = useLabelColumns()
</script>

<template>
  <ListRow
    class="finding-row finding-columns"
    :class="[{ 'with-decision': showDecision, selectable }, classes]"
    :current="current"
    :checked="checked"
    :data-finding-id="finding.id"
  >
    <RowCheckbox v-if="selectable" :checked="checked" @toggle="$emit('toggle')" />
    <span v-else class="no-check" aria-hidden="true" />
    <SeverityChip :severity="finding.severity" :score="finding.score" :source="null" />
    <span v-if="!hidden.includes('kev')" class="kev"><KevChip v-if="finding.kev" /></span>
    <span class="vuln-id">{{ finding.vulnId }}</span>
    <span class="title wide-only">
      <span v-if="isNew" class="new">new</span>
      {{ finding.title ?? '' }}
    </span>
    <span class="image"><ImageName :image-ref="finding.imageRef" /></span>
    <span v-if="!hidden.includes('exposure')" class="exposure">
      <ExposureChip v-if="finding.exposure" :exposure="finding.exposure" />
    </span>
    <OwnerBadge v-if="!hidden.includes('owner')" class="owner wide-only" :owner="finding.owner" />
    <span class="workloads wide-only" :title="countOf(finding.workloadCount, 'workload')">
      {{ finding.workloadCount }}
    </span>
    <span v-if="showDecision" class="decision">
      <DecisionStateChip
        v-if="finding.effective"
        :effective="finding.effective"
        :status="finding.decision?.status ?? null"
      />
      <span v-else class="undecided">Undecided</span>
    </span>
    <span v-else class="seen"><RelativeTime :value="finding.firstSeen" /></span>
  </ListRow>
</template>

<style scoped src="@/components/finding/findingColumns.css"></style>

<style scoped>
.with-decision {
  --last-column: calc(var(--space-base) * 26);
}

.vuln-id {
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  overflow: hidden;
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.new {
  margin-right: var(--space-1);
  color: var(--color-accent);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
}

.image {
  display: block;
  min-width: 0;
}

.undecided {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}

.workloads,
.seen {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
  text-align: right;
}

@container (max-width: 640px) {
  .no-check,
  .kev:empty,
  .exposure:empty {
    display: none;
  }

  .vuln-id {
    flex: 1 1 0;
    min-width: calc(var(--space-base) * 24);
  }

  .image {
    order: 2;
  }

  .title {
    order: 3;
  }

  .decision {
    order: 4;
  }

  .image {
    flex: 0 1 auto;
    max-width: 50%;
    color: var(--color-text);
    font-size: var(--font-size-sm);
  }

  .title {
    display: block;
    flex: 1 1 0;
    min-width: 0;
    font-size: var(--font-size-sm);
  }

  .selectable .image {
    margin-left: calc(var(--checkbox-size) + var(--space-2));
  }
}
</style>
