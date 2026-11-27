<script setup lang="ts">
import { computed } from 'vue'

import { patchTargetOf } from '#core/patchAction.ts'
import type { PatchLayer } from '#core/proposal.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import CopyButton from '@/components/common/CopyButton.vue'
import { PATCH_LAYER_LABELS } from '@/format/proposalLabels'

const props = defineProps<{
  /** Claude-written one-line patch action, never rendered as HTML */
  action: string
  layer: PatchLayer | null
  /** Fixed version of the fix path, the copy target when the action names no other */
  fixedVersion: string | null
}>()

const target = computed(() => patchTargetOf(props.action, props.fixedVersion, props.layer))
</script>

<template>
  <p class="patch-action">
    <BaseChip v-if="layer" class="layer" outline>{{ PATCH_LAYER_LABELS[layer] }}</BaseChip>
    <span class="text">{{ action }}</span>
    <CopyButton v-if="target" :value="target" :label="`Copy ${target}`" />
  </p>
</template>

<style scoped>
.patch-action {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
}

.layer {
  flex: none;
}

.text {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
