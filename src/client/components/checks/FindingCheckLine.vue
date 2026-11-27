<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import CheckChip from '@/components/checks/CheckChip.vue'
import RetryCheckButton from '@/components/checks/RetryCheckButton.vue'
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
  <div v-if="check" class="finding-check">
    <span class="label">Auto-check</span>
    <CheckChip :check="check" focusable />
    <span v-if="check.state === 'failed'" class="error">{{
      check.error ?? NO_FAILURE_REASON
    }}</span>
    <RetryCheckButton :check="check" />
    <RouterLink class="more" :to="{ name: ROUTE_NAMES.CHECKS }">All checks</RouterLink>
  </div>
</template>

<style scoped>
.finding-check {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
}

.label {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
}

.error {
  color: var(--color-danger);
  overflow-wrap: anywhere;
}

.more {
  color: var(--color-text-muted);
}
</style>
