<script setup lang="ts">
import { computed } from 'vue'

import type { ImageAccess } from '#core/imageVisibility.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import { imageAccessChips } from '@/format/imageAccessLabels'

const props = defineProps<{
  access: ImageAccess
}>()

const chips = computed(() => imageAccessChips(props.access))
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
