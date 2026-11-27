<script setup lang="ts">
import type { FindingView } from '#core/findingView.ts'
import FindingCheckChip from '@/components/checks/FindingCheckChip.vue'
import DecisionStateChip from '@/components/chips/DecisionStateChip.vue'
import ExposureChip from '@/components/chips/ExposureChip.vue'
import KevChip from '@/components/chips/KevChip.vue'
import OwnerBadge from '@/components/chips/OwnerBadge.vue'
import SeverityChip from '@/components/chips/SeverityChip.vue'
import UpstreamPendingChip from '@/components/chips/UpstreamPendingChip.vue'
import ImageName from '@/components/common/ImageName.vue'
import NewDot from '@/components/common/NewDot.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import InboxMarker from '@/components/inbox/InboxMarker.vue'
import ListRow from '@/components/list/ListRow.vue'
import RowCheckbox from '@/components/list/RowCheckbox.vue'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { countOf } from '@/format/count'

withDefaults(
  defineProps<{
    finding: FindingView
    current: boolean
    checked: boolean
    /** First seen within the last seven days and not seen by the user yet */
    isNew: boolean
    /** Shows the checkbox for bulk selection, lists without bulk actions leave its column empty */
    selectable?: boolean
    /** Shows the state of the governing decision instead of the first sighting */
    showDecision?: boolean
  }>(),
  { selectable: true, showDecision: false },
)

defineEmits<{ toggle: [event: MouseEvent]; select: [event: MouseEvent] }>()

const { hidden, classes } = useLabelColumns()
</script>

<template>
  <ListRow
    class="finding-row finding-columns"
    :class="[{ 'with-decision': showDecision, selectable }, classes]"
    :current="current"
    :checked="checked"
    :data-finding-id="finding.id"
    @click="$emit('select', $event)"
  >
    <RowCheckbox v-if="selectable" :checked="checked" @toggle="$emit('toggle', $event)" />
    <span v-else class="no-check" aria-hidden="true" />
    <SeverityChip :severity="finding.severity" :score="finding.score" :source="null" />
    <span v-if="!hidden.includes('kev')" class="kev"><KevChip v-if="finding.kev" /></span>
    <span class="vuln-id" data-panel-clip>
      {{ finding.vulnId }}
      <NewDot v-if="isNew" class="mid-only" :since="finding.firstSeen" />
      <InboxMarker class="mid-only" :finding="finding" />
      <FindingCheckChip class="mid-only" :finding-id="finding.id" />
    </span>
    <span class="title wide-only" data-panel-clip>
      <NewDot v-if="isNew" class="new" :since="finding.firstSeen" />
      <InboxMarker class="marker" :finding="finding" />
      <FindingCheckChip class="marker" :finding-id="finding.id" />
      <UpstreamPendingChip
        v-if="finding.decision?.upstreamPending && finding.effective?.state !== 'revoked'"
        class="marker"
        :waiting-for="finding.decision.waitingFor"
      />
      {{ finding.title ?? '' }}
    </span>
    <span class="image" data-panel-clip><ImageName :image-ref="finding.imageRef" /></span>
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
        :justification="finding.decision?.justification ?? null"
      />
      <span v-else class="undecided">Undecided</span>
    </span>
    <span v-else class="seen"><RelativeTime :value="finding.firstSeen" /></span>
  </ListRow>
</template>

<style scoped src="@/components/finding/findingColumns.css"></style>

<style scoped>
.with-decision {
  --last-column: var(--col-decision-state);
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

.marker {
  margin-right: var(--space-1-5);
}

/* the title column holds the chip on wide and narrow rows, the 1fr id column in between */
.vuln-id .mid-only {
  display: none;
  margin-left: var(--space-1-5);
}

@container (min-width: 641px) and (max-width: 900px) {
  .vuln-id .mid-only {
    display: inline-flex;
  }
}

.new {
  margin-right: var(--space-1-5);
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
</style>

<style scoped src="@/components/finding/findingRowNarrow.css"></style>
