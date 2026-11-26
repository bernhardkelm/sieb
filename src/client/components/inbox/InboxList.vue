<script setup lang="ts">
import type { FindingView } from '#core/findingView.ts'
import FindingRow from '@/components/finding/FindingRow.vue'
import { INBOX_SORT_COLUMNS, type InboxSortColumn } from '@/components/inbox/inboxSort'
import DenseList from '@/components/list/DenseList.vue'
import ListHeader from '@/components/list/ListHeader.vue'
import type { SortState } from '@/components/list/listSort'
import SortHeader from '@/components/list/SortHeader.vue'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { useNow } from '@/composables/useNow'
import { isNewFinding } from '@/stores/findingFilters'

defineProps<{
  findings: FindingView[]
  currentId: number | null
  checkedIds: Set<number>
  sort: SortState<InboxSortColumn> | null
}>()

defineEmits<{
  select: [id: number, event: MouseEvent]
  toggle: [id: number, event: MouseEvent]
  sort: [column: InboxSortColumn]
}>()

const now = useNow()
const columns = INBOX_SORT_COLUMNS
const { hidden, classes } = useLabelColumns()
</script>

<template>
  <div class="inbox-list">
    <ListHeader class="finding-columns" :class="classes" label="Inbox columns">
      <span aria-hidden="true" />
      <SortHeader column="severity" :columns="columns" :sort="sort" @sort="$emit('sort', $event)" />
      <SortHeader
        v-if="!hidden.includes('kev')"
        column="kev"
        :columns="columns"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
      <SortHeader column="vulnId" :columns="columns" :sort="sort" @sort="$emit('sort', $event)" />
      <SortHeader
        class="wide-only"
        column="title"
        :columns="columns"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
      <SortHeader column="image" :columns="columns" :sort="sort" @sort="$emit('sort', $event)" />
      <SortHeader
        v-if="!hidden.includes('exposure')"
        column="exposure"
        :columns="columns"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
      <SortHeader
        v-if="!hidden.includes('owner')"
        class="wide-only"
        column="owner"
        :columns="columns"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
      <SortHeader
        class="wide-only"
        column="workloads"
        short="Workl."
        end
        :columns="columns"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
      <SortHeader
        column="firstSeen"
        short="Seen"
        end
        :columns="columns"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
    </ListHeader>
    <DenseList label="Inbox findings">
      <FindingRow
        v-for="finding in findings"
        :key="finding.id"
        :finding="finding"
        :current="finding.id === currentId"
        :checked="checkedIds.has(finding.id)"
        :is-new="isNewFinding(finding.firstSeen, now)"
        @click="$emit('select', finding.id, $event)"
        @toggle="$emit('toggle', finding.id, $event)"
      />
    </DenseList>
  </div>
</template>

<style scoped src="@/components/finding/findingColumns.css"></style>

<style scoped>
.inbox-list {
  container-type: inline-size;
}
</style>
