<script setup lang="ts">
import { computed } from 'vue'

import type { ImageAccess } from '#core/imageVisibility.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import { imageAccessChips } from '@/format/imageAccessLabels'

const props = defineProps<{
  access: ImageAccess
  /** Whether an owner chip sits next to these chips, drops the Own image chip */
  ownerShown?: boolean
}>()

const chips = computed(() => imageAccessChips(props.access, props.ownerShown))
</script>

<template>
  <HintTooltip v-for="chip in chips" :key="chip.kind" :text="chip.hint">
    <BaseChip
      variant="outline"
      class="image-access-chip"
      :data-ownership="chip.kind === 'ownership' ? chip.value : undefined"
      :data-visibility="chip.kind === 'visibility' ? chip.value : undefined"
      focusable
    >
      {{ chip.label }}
    </BaseChip>
  </HintTooltip>
</template>
