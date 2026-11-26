<script setup lang="ts">
import type { CveAggregate } from '#core/cveAggregation.ts'
import type { FindingView } from '#core/findingView.ts'
import CveActions from '@/components/cves/CveActions.vue'
import CveRow from '@/components/cves/CveRow.vue'
import { CVE_SORT_COLUMNS, type CveSortColumn } from '@/components/cves/cveSort'
import NestedFindingRows from '@/components/finding/NestedFindingRows.vue'
import DenseList from '@/components/list/DenseList.vue'
import ListHeader from '@/components/list/ListHeader.vue'
import type { SortState } from '@/components/list/listSort'
import SortHeader from '@/components/list/SortHeader.vue'
import NestedPanel from '@/components/list/NestedPanel.vue'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { groupRowKey } from '@/keyboard/rowKey'

defineProps<{
  cves: CveAggregate[]
  expandedId: string | null
  currentKey: string | null
  /** Open findings of the expanded CVE */
  findings: FindingView[]
  findingsLoaded: boolean
  /** Decision summary per vuln_id */
  summaries: Map<string, string>
  sort: SortState<CveSortColumn> | null
}>()

defineEmits<{
  select: [key: string]
  bulk: [vulnId: string]
  decideAll: [vulnId: string]
  sort: [column: CveSortColumn]
}>()

const columns = CVE_SORT_COLUMNS
const { hidden, classes } = useLabelColumns()
</script>

<template>
  <div class="cve-list">
    <DenseList class="columns" :class="classes" label="CVEs" kind="treegrid">
      <ListHeader>
        <span aria-hidden="true" />
        <SortHeader
          column="severity"
          :columns="columns"
          :sort="sort"
          @sort="$emit('sort', $event)"
        />
        <SortHeader
          v-if="!hidden.includes('kev')"
          column="kev"
          :columns="columns"
          :sort="sort"
          @sort="$emit('sort', $event)"
        />
        <SortHeader column="vulnId" :columns="columns" :sort="sort" @sort="$emit('sort', $event)" />
        <SortHeader
          class="optional"
          column="title"
          :columns="columns"
          :sort="sort"
          @sort="$emit('sort', $event)"
        />
        <SortHeader
          column="images"
          end
          :columns="columns"
          :sort="sort"
          @sort="$emit('sort', $event)"
        />
        <SortHeader
          v-if="!hidden.includes('exposure')"
          class="optional"
          column="exposure"
          :columns="columns"
          :sort="sort"
          @sort="$emit('sort', $event)"
        />
        <SortHeader
          column="open"
          end
          :columns="columns"
          :sort="sort"
          @sort="$emit('sort', $event)"
        />
        <SortHeader
          column="inbox"
          end
          :columns="columns"
          :sort="sort"
          @sort="$emit('sort', $event)"
        />
        <span role="columnheader">Decisions</span>
      </ListHeader>
      <template v-for="cve in cves" :key="cve.vulnId">
        <CveRow
          :cve="cve"
          :current="currentKey === groupRowKey(cve.vulnId)"
          :expanded="expandedId === cve.vulnId"
          :summary="summaries.get(cve.vulnId) ?? ''"
          :data-row-key="groupRowKey(cve.vulnId)"
          @click="$emit('select', groupRowKey(cve.vulnId))"
        />
        <template v-if="expandedId === cve.vulnId">
          <NestedPanel>
            <CveActions
              :cve="cve"
              @bulk="$emit('bulk', cve.vulnId)"
              @decide-all="$emit('decideAll', cve.vulnId)"
            />
          </NestedPanel>
          <NestedFindingRows
            :findings="findings"
            :current-key="currentKey"
            :loaded="findingsLoaded"
            @select="$emit('select', $event)"
          />
        </template>
      </template>
    </DenseList>
  </div>
</template>

<style scoped>
.cve-list {
  container-type: inline-size;
}

.columns {
  --row-columns: var(--chevron-size) calc(var(--space-base) * 15)
    var(--kev-track, calc(var(--space-base) * 8)) calc(var(--space-base) * 34) minmax(0, 1fr)
    var(--count-width) calc(var(--space-base) * 16) var(--count-width) var(--count-width)
    calc(var(--space-base) * 56);
}

/* no-kev empties --kev-track, an empty custom property drops the track from the list */
.columns.no-kev {
  --kev-track: ;
}

/* no-exposure drops the exposure track while no open finding has an exposure label */
.columns.no-exposure {
  --row-columns: var(--chevron-size) calc(var(--space-base) * 15)
    var(--kev-track, calc(var(--space-base) * 8)) calc(var(--space-base) * 34) minmax(0, 1fr)
    var(--count-width) var(--count-width) var(--count-width) calc(var(--space-base) * 56);
}

@container (max-width: 900px) {
  .columns,
  .columns.no-exposure {
    --row-columns: var(--chevron-size) calc(var(--space-base) * 15)
      var(--kev-track, calc(var(--space-base) * 8)) minmax(0, 1fr) var(--count-width)
      var(--count-width) var(--count-width) calc(var(--space-base) * 40);
  }

  .optional {
    display: none;
  }
}
</style>
