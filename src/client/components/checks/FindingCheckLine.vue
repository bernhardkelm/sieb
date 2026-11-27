<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import CheckChip from '@/components/checks/CheckChip.vue'
import RetryCheckButton from '@/components/checks/RetryCheckButton.vue'
import PanelLine from '@/components/common/PanelLine.vue'
import { NO_FAILURE_REASON } from '@/format/checkText'
import { ROUTE_NAMES } from '@/router/routeNames'
import { useChecksStore } from '@/stores/checksStore'

const props = defineProps<{
  findingId: number
}>()

const checks = useChecksStore()
const check = computed(() => (checks.enabled ? checks.latestFor(props.findingId) : null))
</script>

<template>
  <PanelLine v-if="check" class="finding-check" label="Auto-check">
    <CheckChip :check="check" focusable />
    <span v-if="check.state === 'failed'" class="error">{{
      check.error ?? NO_FAILURE_REASON
    }}</span>
    <RetryCheckButton :check="check" />
    <RouterLink class="more" :to="{ name: ROUTE_NAMES.CHECKS }">All checks</RouterLink>
  </PanelLine>
</template>

<style scoped>
.error {
  color: var(--color-danger);
  overflow-wrap: anywhere;
}

.more {
  color: var(--color-text-muted);
}
</style>
