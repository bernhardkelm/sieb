<script setup lang="ts">
import { computed } from 'vue'

import type { FindingView } from '#core/findingView.ts'
import type { ImageAggregate } from '#core/imageAggregation.ts'
import NestedFindingRow from '@/components/finding/NestedFindingRow.vue'
import ImageRow from '@/components/images/ImageRow.vue'
import { IMAGE_SORT_COLUMNS, type ImageSortColumn } from '@/components/images/imageSort'
import DenseList from '@/components/list/DenseList.vue'
import {
  flattenTree,
  isCursorItem,
  treeItemEstimate,
  treeItemKey,
} from '@/components/list/flattenTree'
import ListHeader from '@/components/list/ListHeader.vue'
import type { SortState } from '@/components/list/listSort'
import SortHeader from '@/components/list/SortHeader.vue'
import { useLabelColumns } from '@/composables/useLabelColumns'

const props = defineProps<{
  images: ImageAggregate[]
  expandedRef: string | null
  currentKey: string | null
  /** Open findings of the expanded image */
  findings: FindingView[]
  findingsLoaded: boolean
  sort: SortState<ImageSortColumn> | null
}>()

defineEmits<{ select: [key: string]; sort: [column: ImageSortColumn] }>()

const columns = IMAGE_SORT_COLUMNS
const { hidden, classes } = useLabelColumns()

const items = computed(() =>
  flattenTree({
    groups: props.images,
    idOf: (image) => image.imageRef,
    expanded: props.expandedRef,
    findings: props.findings,
    loaded: props.findingsLoaded,
  }),
)
const estimate = treeItemEstimate(0)
</script>

<template>
  <div class="image-list">
    <DenseList
      class="columns"
      :class="classes"
      label="Images"
      kind="treegrid"
      :items="items"
      :key-of="treeItemKey"
      :estimate="estimate"
      :pinned="currentKey"
      :cursor-row="isCursorItem"
    >
      <template #header>
        <ListHeader>
          <span aria-hidden="true" />
          <SortHeader column="name" :columns="columns" :sort="sort" @sort="$emit('sort', $event)" />
          <SortHeader
            v-if="!hidden.includes('owner')"
            class="optional"
            column="owner"
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <SortHeader
            v-if="!hidden.includes('exposure')"
            column="exposure"
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <SortHeader
            column="severity"
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <SortHeader
            v-if="!hidden.includes('kev')"
            column="kev"
            end
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
          <SortHeader
            class="optional"
            column="notAffected"
            short="Not aff."
            end
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <SortHeader
            class="optional"
            column="accepted"
            end
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <SortHeader
            class="optional"
            column="workloads"
            short="Workl."
            end
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
        </ListHeader>
      </template>
      <template #default="{ item, attrs, measure }">
        <ImageRow
          v-if="item.kind === 'group'"
          :ref="measure"
          v-bind="attrs"
          :image="item.group"
          :current="currentKey === item.key"
          :expanded="item.expanded"
          :data-row-key="item.key"
          @select="$emit('select', item.key)"
        />
        <NestedFindingRow
          v-else-if="item.kind !== 'panel'"
          :ref="measure"
          v-bind="attrs"
          :item="item"
          :current-key="currentKey"
          @select="$emit('select', $event)"
        />
      </template>
    </DenseList>
  </div>
</template>

<style scoped src="@/components/images/imageColumns.css"></style>
