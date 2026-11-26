<script setup lang="ts">
import { SELF_OWNER } from '#core/owner.ts'
import { ownerLabel } from '@/format/labels'

defineProps<{
  /** Free-form owner label, null renders an empty cell */
  owner: string | null
}>()
</script>

<template>
  <span class="owner-badge" :class="{ own: owner === SELF_OWNER }" :title="owner ?? undefined">
    {{ owner === null ? '' : ownerLabel(owner) }}
  </span>
</template>

<style scoped>
.owner-badge {
  overflow: hidden;
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.own {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}
</style>
