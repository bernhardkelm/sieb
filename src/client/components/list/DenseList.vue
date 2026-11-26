<script setup lang="ts" generic="T, K extends string | number">
import { computed, provide, useSlots, useTemplateRef } from 'vue'

import { LIST_KIND, type ListKind } from '@/components/list/listKind'
import { rowAria } from '@/components/list/virtualRows'
import { useWindowRows } from '@/composables/useWindowRows'

const props = withDefaults(
  defineProps<{
    label: string
    /** listbox for flat rows checked for bulk actions, treegrid for expandable groups with actions */
    kind?: ListKind
    items: readonly T[]
    keyOf: (item: T) => K
    /** Estimated height in px of a row until it is measured */
    estimate: (item: T, narrow: boolean) => number
    /** Row under the keyboard cursor, rendered wherever the list is scrolled */
    pinned: K | null
    /** Whether a row takes the cursor, all rows do when omitted */
    cursorRow?: (item: T) => boolean
  }>(),
  { kind: 'listbox', cursorRow: () => true },
)

defineSlots<{
  header?: () => unknown
  default: (scope: {
    item: T
    index: number
    attrs: Record<string, unknown>
    measure: (target: unknown) => void
  }) => unknown
}>()

provide(LIST_KIND, props.kind)

const slots = useSlots()
const list = useTemplateRef<HTMLElement>('list')
const origin = useTemplateRef<HTMLElement>('origin')
const headerRows = computed(() => (slots.header ? 1 : 0))

const { rows, totalSize, measure } = useWindowRows(list, origin, {
  items: () => props.items,
  keyOf: (item) => props.keyOf(item),
  estimate: (item, narrow) => props.estimate(item, narrow),
  pinned: () => props.pinned,
  cursorRow: (item) => props.cursorRow(item),
})

let attrsCache = new Map<K, { signature: string; attrs: Record<string, unknown> }>()

// rows keep their attrs object while index, offset and list size stay, so scrolling patches only new rows
const rendered = computed(() => {
  const next = new Map<K, { signature: string; attrs: Record<string, unknown> }>()
  const count = props.items.length
  const result = rows.value.map((row) => {
    const signature = `${row.index}:${row.offset}:${count}:${headerRows.value}`
    const cached = attrsCache.get(row.key)
    const attrs =
      cached?.signature === signature
        ? cached.attrs
        : {
            'data-index': row.index,
            style: { transform: `translateY(${row.offset}px)` },
            ...rowAria(props.kind, row.index, count, headerRows.value),
          }

    next.set(row.key, { signature, attrs })
    return { ...row, attrs }
  })

  attrsCache = next
  return result
})
</script>

<template>
  <ul
    ref="list"
    class="dense-list"
    :role="kind"
    :aria-multiselectable="kind === 'listbox' || undefined"
    :aria-rowcount="kind === 'treegrid' ? items.length + headerRows : undefined"
    :aria-label="label"
  >
    <slot name="header" />
    <li
      ref="origin"
      class="origin"
      role="none"
      aria-hidden="true"
      :style="{ height: `${totalSize}px` }"
    />
    <template v-for="row in rendered" :key="row.key">
      <slot :item="row.item" :index="row.index" :attrs="row.attrs" :measure="measure" />
    </template>
  </ul>
</template>

<style scoped>
.dense-list {
  position: relative;
  container-type: inline-size;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* virtualized rows sit at their measured offset, the origin holds the height of all rows */
.dense-list > :deep([data-index]) {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
}
</style>
