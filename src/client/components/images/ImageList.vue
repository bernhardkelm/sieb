<script setup lang="ts">
import type { FindingView } from '#core/findingView.ts'
import type { ImageAggregate } from '#core/imageAggregation.ts'
import NestedFindingRows from '@/components/finding/NestedFindingRows.vue'
import ImageRow from '@/components/images/ImageRow.vue'
import { IMAGE_SORT_COLUMNS, type ImageSortColumn } from '@/components/images/imageSort'
import DenseList from '@/components/list/DenseList.vue'
import ListHeader from '@/components/list/ListHeader.vue'
import type { SortState } from '@/components/list/listSort'
import SortHeader from '@/components/list/SortHeader.vue'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { groupRowKey } from '@/keyboard/rowKey'

defineProps<{
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
</script>

<template>
  <div class="image-list">
    <DenseList class="columns" :class="classes" label="Images" kind="treegrid">
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
          column="silenced"
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
      <template v-for="image in images" :key="image.imageRef">
        <ImageRow
          :image="image"
          :current="currentKey === groupRowKey(image.imageRef)"
          :expanded="expandedRef === image.imageRef"
          :data-row-key="groupRowKey(image.imageRef)"
          @click="$emit('select', groupRowKey(image.imageRef))"
        />
        <template v-if="expandedRef === image.imageRef">
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
.image-list {
  container-type: inline-size;
}

.columns {
  --row-columns: var(--chevron-size) minmax(0, 1fr) calc(var(--space-base) * 20)
    calc(var(--space-base) * 16) calc(var(--space-base) * 40) var(--kev-track, var(--count-width))
    var(--count-width) var(--count-width) calc(var(--space-base) * 14) var(--count-width);
}

/* no-kev empties --kev-track, an empty custom property drops the track from the list */
.columns.no-kev {
  --kev-track: ;
}

/* no-exposure and no-owner drop the tracks of label columns no open finding has */
.columns.no-owner {
  --row-columns: var(--chevron-size) minmax(0, 1fr) calc(var(--space-base) * 16)
    calc(var(--space-base) * 40) var(--kev-track, var(--count-width)) var(--count-width)
    var(--count-width) calc(var(--space-base) * 14) var(--count-width);
}

.columns.no-exposure {
  --row-columns: var(--chevron-size) minmax(0, 1fr) calc(var(--space-base) * 20)
    calc(var(--space-base) * 40) var(--kev-track, var(--count-width)) var(--count-width)
    var(--count-width) calc(var(--space-base) * 14) var(--count-width);
}

.columns.no-exposure.no-owner {
  --row-columns: var(--chevron-size) minmax(0, 1fr) calc(var(--space-base) * 40)
    var(--kev-track, var(--count-width)) var(--count-width) var(--count-width)
    calc(var(--space-base) * 14) var(--count-width);
}

@container (max-width: 900px) {
  .columns,
  .columns.no-owner {
    --row-columns: var(--chevron-size) minmax(0, 1fr) calc(var(--space-base) * 16)
      calc(var(--space-base) * 40) var(--kev-track, var(--count-width)) var(--count-width)
      var(--count-width);
  }

  .columns.no-exposure,
  .columns.no-exposure.no-owner {
    --row-columns: var(--chevron-size) minmax(0, 1fr) calc(var(--space-base) * 40)
      var(--kev-track, var(--count-width)) var(--count-width) var(--count-width);
  }

  .optional {
    display: none;
  }
}
</style>
