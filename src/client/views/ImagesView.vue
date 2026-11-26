<script setup lang="ts">
import { ref } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadState from '@/components/common/LoadState.vue'
import AggregateFilterBar from '@/components/filters/AggregateFilterBar.vue'
import { emptyAggregateFilters, hasAggregateFilters } from '@/components/filters/aggregateFilters'
import ImageList from '@/components/images/ImageList.vue'
import { IMAGE_SORT_COLUMNS } from '@/components/images/imageSort'
import ImagesSummary from '@/components/images/ImagesSummary.vue'
import ViewToolbar from '@/components/layout/ViewToolbar.vue'
import SortMenu from '@/components/list/SortMenu.vue'
import { useImagesController } from '@/composables/useImagesController'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { useFindingsStore } from '@/stores/findingsStore'
import { useImagesStore } from '@/stores/imagesStore'
import { useLabelsStore } from '@/stores/labelsStore'

const store = useImagesStore()
const labels = useLabelsStore()
const findings = useFindingsStore()
const filterBar = ref<InstanceType<typeof AggregateFilterBar> | null>(null)

const controller = useImagesController(() => filterBar.value?.focusSearch())
const { filters, images, hiddenCount, sort, expandedRef, expandedFindings, currentKey } = controller

const { hidden } = useLabelColumns()
</script>

<template>
  <div class="images-view">
    <ViewToolbar>
      <AggregateFilterBar
        ref="filterBar"
        v-model:filters="filters"
        :fields="['owner', 'exposure', 'severity']"
        :toggles="{ showNotAffected: 'Show not affected' }"
        placeholder="Search image or workload"
      >
        <SortMenu
          :columns="IMAGE_SORT_COLUMNS"
          :hidden="hidden"
          :sort="sort.sort.value"
          @change="sort.set"
        />
      </AggregateFilterBar>
    </ViewToolbar>
    <LoadState
      v-if="!store.loaded || labels.pending"
      subject="images"
      :error="store.error"
      @retry="store.refresh()"
    />
    <EmptyState v-else-if="store.items.length === 0" title="No images">
      No image has open findings. Images show up here after the next sync.
    </EmptyState>
    <template v-else>
      <ImagesSummary
        :images="images"
        :total="store.items.length"
        :hidden="hiddenCount"
        :sort-label="sort.label.value"
        @reset-sort="controller.resetSort"
      />
      <EmptyState
        v-if="images.length === 0"
        :title="hasAggregateFilters(filters) ? 'No matches' : 'No open risk'"
      >
        {{
          hasAggregateFilters(filters)
            ? 'No image matches these filters.'
            : 'Every image has only not affected findings open.'
        }}
        <BaseButton
          v-if="hiddenCount > 0"
          variant="ghost"
          @click="filters = { ...filters, showNotAffected: true }"
        >
          Show not affected
        </BaseButton>
        <BaseButton
          v-if="hasAggregateFilters(filters)"
          variant="ghost"
          @click="filters = emptyAggregateFilters()"
        >
          Reset filters
        </BaseButton>
      </EmptyState>
      <ImageList
        v-else
        :images="images"
        :expanded-ref="expandedRef"
        :current-key="currentKey"
        :findings="expandedFindings"
        :findings-loaded="findings.loaded"
        :sort="sort.sort.value"
        @select="controller.select"
        @sort="sort.toggle"
      />
    </template>
  </div>
</template>
