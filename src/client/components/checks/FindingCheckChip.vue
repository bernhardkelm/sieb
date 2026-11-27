<script setup lang="ts">
import { computed } from 'vue'

import CheckChip from '@/components/checks/CheckChip.vue'
import { useChecksStore } from '@/stores/checksStore'

const props = withDefaults(
  defineProps<{
    findingId: number
    /** row shows open and failed checks only, panel the latest check in any state */
    mode?: 'row' | 'panel'
  }>(),
  { mode: 'row' },
)

const checks = useChecksStore()
const check = computed(() =>
  props.mode === 'row' ? checks.rowCheckFor(props.findingId) : checks.latestFor(props.findingId),
)
</script>

<template>
  <CheckChip v-if="checks.enabled && check" :check="check" :focusable="mode === 'panel'" />
</template>
