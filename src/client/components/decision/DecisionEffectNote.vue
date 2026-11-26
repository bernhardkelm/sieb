<script setup lang="ts">
import type { DecisionStatus } from '#core/decision.ts'

defineProps<{
  /** Chosen status, no note while none is chosen */
  status: DecisionStatus | null
}>()
</script>

<template>
  <p v-if="status === 'fix_planned'" class="note">
    Fix planned leaves Triage, but alerts keep firing.
  </p>
  <p v-else-if="status !== null" class="note">
    Alerts stop within about two minutes, including alerts that already fire. Revoking or expiry
    brings the finding back at once; its alert fires again after the usual 30 minutes.
  </p>
</template>

<style scoped>
.note {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}
</style>
