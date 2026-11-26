<script setup lang="ts">
import type { Exposure } from '#core/exposure.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import { EXPOSURE_LABELS } from '@/format/labels'

defineProps<{
  exposure: Exposure
}>()
</script>

<template>
  <BaseChip :tone="exposure === 'public' ? 'warning' : 'neutral'" :outline="exposure !== 'public'">
    {{ EXPOSURE_LABELS[exposure] }}
  </BaseChip>
</template>
