<script setup lang="ts">
import type { InboxItem } from '#core/inbox/inboxItem.ts'
import InboxRow from '@/components/inbox/InboxRow.vue'
import DenseList from '@/components/list/DenseList.vue'
import { rowEstimate } from '@/components/list/virtualRows'
import { useLabelsStore } from '@/stores/labelsStore'

defineProps<{
  items: InboxItem[]
  currentKey: string | null
  checkedKeys: Set<string>
}>()

defineEmits<{
  select: [key: string, event: MouseEvent]
  toggle: [key: string, event: MouseEvent]
  seen: [key: string]
}>()

const labels = useLabelsStore()

/**
 * Returns the virtualizer key of an Inbox row, its item key as the cursor uses it.
 * @param {InboxItem} item - Item
 * @returns {string} - Item key
 */
const keyOf = (item: InboxItem): string => item.key

/**
 * Estimates the height of an Inbox row until it is measured.
 * @param {InboxItem} _item - Item
 * @param {boolean} narrow - Whether the row wraps to two lines
 * @returns {number} - Height in px
 */
const estimate = (_item: InboxItem, narrow: boolean): number => rowEstimate(narrow)
</script>

<template>
  <div class="inbox-list" data-list-background>
    <DenseList
      label="Inbox items"
      :items="items"
      :key-of="keyOf"
      :estimate="estimate"
      :pinned="currentKey"
    >
      <template #default="{ item, attrs, measure }">
        <InboxRow
          :ref="measure"
          v-bind="attrs"
          :item="item"
          :current="item.key === currentKey"
          :checked="checkedKeys.has(item.key)"
          :hide-kev="!labels.showKev"
          @select="$emit('select', item.key, $event)"
          @toggle="$emit('toggle', item.key, $event)"
          @seen="$emit('seen', item.key)"
        />
      </template>
    </DenseList>
  </div>
</template>

<style scoped>
.inbox-list {
  container-type: inline-size;
}
</style>
