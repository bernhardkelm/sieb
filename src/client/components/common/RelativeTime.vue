<script setup lang="ts">
import { computed } from 'vue'

import HintTooltip from '@/components/common/HintTooltip.vue'
import { useNow } from '@/composables/useNow'
import { formatAbsolute, formatRelative } from '@/format/relativeTime'

const props = withDefaults(
  defineProps<{
    /** ISO timestamp, null shows the fallback */
    value: string | null
    fallback?: string
  }>(),
  { fallback: 'never' },
)

const now = useNow()

const relative = computed(() =>
  props.value === null ? props.fallback : formatRelative(props.value, now.value),
)
const absolute = computed(() => (props.value === null ? '' : formatAbsolute(props.value)))
</script>

<template>
  <HintTooltip v-if="value !== null" :text="absolute">
    <time class="relative-time" :datetime="value">{{ relative }}</time>
  </HintTooltip>
  <span v-else class="relative-time">{{ relative }}</span>
</template>

<style scoped>
.relative-time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
</style>
