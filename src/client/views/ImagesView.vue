<script setup lang="ts">
import { ref } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadState from '@/components/common/LoadState.vue'
import AggregateFilterBar from '@/components/filters/AggregateFilterBar.vue'
import { emptyAggregateFilters } from '@/components/filters/aggregateFilters'
import ImageList from '@/components/images/ImageList.vue'
import { IMAGE_SORT_COLUMNS } from '@/components/images/imageSort'
import ImagesSummary from '@/components/images/ImagesSummary.vue'
import ViewToolbar from '@/components/layout/ViewToolbar.vue'
import SortMenu from '@/components/list/SortMenu.vue'
import { useImagesController } from '@/composables/useImagesController'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { useFindingsStore } from '@/stores/findingsStore'
import { useImagesStore } from '@/stores/imagesStore'

const store = useImagesStore()
const findings = useFindingsStore()
const filterBar = ref<InstanceType<typeof AggregateFilterBar> | null>(null)

const { filters, images, sort, resetSort, expandedRef, expandedFindings, currentKey, select } =
  useImagesController(() => filterBar.value?.focusSearch())

const { hidden } = useLabelColumns()
</script>

<template>
  <div class="images-view">
    <ViewToolbar>
      <AggregateFilterBar
        ref="filterBar"
        v-model:filters="filters"
        :fields="['owner', 'exposure', 'severity']"
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
      v-if="!store.loaded"
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
        :sort-label="sort.label.value"
        @reset-sort="resetSort"
      />
      <EmptyState v-if="images.length === 0" title="No matches">
        No image matches these filters.
        <BaseButton variant="ghost" @click="filters = emptyAggregateFilters()">
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
        @select="select"
        @sort="sort.toggle"
      />
    </template>
  </div>
</template>
