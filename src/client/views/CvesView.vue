<script setup lang="ts">
import { ref } from 'vue'

import AllClear from '@/components/common/AllClear.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadState from '@/components/common/LoadState.vue'
import CveDecisionDialog from '@/components/cves/CveDecisionDialog.vue'
import CveList from '@/components/cves/CveList.vue'
import { CVE_SORT_COLUMNS } from '@/components/cves/cveSort'
import CvesSummary from '@/components/cves/CvesSummary.vue'
import BulkDecisionDialog from '@/components/decision/BulkDecisionDialog.vue'
import AggregateFilterBar from '@/components/filters/AggregateFilterBar.vue'
import { emptyAggregateFilters, hasAggregateFilters } from '@/components/filters/aggregateFilters'
import ViewToolbar from '@/components/layout/ViewToolbar.vue'
import SortMenu from '@/components/list/SortMenu.vue'
import { useCvesController } from '@/composables/useCvesController'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { useCvesStore } from '@/stores/cvesStore'
import { useFindingsStore } from '@/stores/findingsStore'

const store = useCvesStore()
const findings = useFindingsStore()
const filterBar = ref<InstanceType<typeof AggregateFilterBar> | null>(null)

const controller = useCvesController(() => filterBar.value?.focusSearch())
const { filters, cves, hiddenCount, sort, expandedId, expandedFindings, summaries, currentKey } =
  controller
const { bulkOpen, bulkTargets, decideOpen, decideCve } = controller

const { hidden } = useLabelColumns()
</script>

<template>
  <div class="cves-view">
    <ViewToolbar>
      <AggregateFilterBar
        ref="filterBar"
        v-model:filters="filters"
        :fields="['severity', 'exposure']"
        :toggles="{ showDecided: 'Show decided' }"
        placeholder="Search CVE, title or image"
      >
        <SortMenu
          :columns="CVE_SORT_COLUMNS"
          :hidden="hidden"
          :sort="sort.sort.value"
          @change="sort.set"
        />
      </AggregateFilterBar>
    </ViewToolbar>
    <LoadState v-if="!store.loaded" subject="CVEs" :error="store.error" @retry="store.refresh()" />
    <EmptyState v-else-if="store.items.length === 0" title="No CVEs">
      No open findings. CVEs show up here after the next sync.
    </EmptyState>
    <template v-else>
      <CvesSummary
        :cves="cves"
        :total="store.items.length"
        :hidden="hiddenCount"
        :sort-label="sort.label.value"
        @reset-sort="controller.resetSort"
      />
      <AllClear
        v-if="cves.length === 0 && !hasAggregateFilters(filters)"
        title="Nothing left to decide"
      >
        Every CVE is fully decided, the decisions view lists them.
        <template #actions>
          <BaseButton variant="ghost" @click="filters = { ...filters, showDecided: true }">
            Show decided
          </BaseButton>
        </template>
      </AllClear>
      <EmptyState v-else-if="cves.length === 0" title="No matches">
        No CVE matches these filters.
        <BaseButton
          v-if="hiddenCount > 0"
          variant="ghost"
          @click="filters = { ...filters, showDecided: true }"
        >
          Show decided
        </BaseButton>
        <BaseButton variant="ghost" @click="filters = emptyAggregateFilters()">
          Reset filters
        </BaseButton>
      </EmptyState>
      <CveList
        v-else
        :cves="cves"
        :expanded-id="expandedId"
        :current-key="currentKey"
        :findings="expandedFindings"
        :findings-loaded="findings.loaded"
        :summaries="summaries"
        :sort="sort.sort.value"
        @select="controller.select"
        @sort="sort.toggle"
        @bulk="controller.openBulk"
        @decide-all="controller.openDecideAll"
      />
    </template>
    <BulkDecisionDialog v-model:open="bulkOpen" :targets="bulkTargets" />
    <CveDecisionDialog v-model:open="decideOpen" :cve="decideCve" />
  </div>
</template>
