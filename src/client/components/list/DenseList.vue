<script setup lang="ts">
import { provide } from 'vue'

import { LIST_KIND, type ListKind } from '@/components/list/listKind'

const props = withDefaults(
  defineProps<{
    label: string
    /** listbox for flat rows checked for bulk actions, treegrid for expandable groups with actions */
    kind?: ListKind
  }>(),
  { kind: 'listbox' },
)

provide(LIST_KIND, props.kind)
</script>

<template>
  <ul
    class="dense-list"
    :role="kind"
    :aria-multiselectable="kind === 'listbox' || undefined"
    :aria-label="label"
  >
    <slot />
  </ul>
</template>

<style scoped>
.dense-list {
  container-type: inline-size;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
