<script setup lang="ts">
import { computed } from 'vue'

import type { ProposalDetail } from '#core/apiTypes.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import HandoffButton from '@/components/finding/HandoffButton.vue'
import { useProposalRecheck } from '@/composables/useProposalRecheck'

const props = defineProps<{
  detail: ProposalDetail
}>()

const { mode, blockedBy, submitting, handoff, run } = useProposalRecheck(() => props.detail)

const blocked = computed(() => blockedBy.value !== null || submitting.value)
</script>

<template>
  <BaseButton
    v-if="mode === 'auto'"
    class="recheck"
    :aria-disabled="blocked || undefined"
    :aria-busy="submitting || undefined"
    :title="blockedBy ?? 'Queue an Auto-check of the target findings, it files a new proposal'"
    @click="run()"
  >
    Re-check
  </BaseButton>
  <HandoffButton
    v-else-if="handoff"
    class="recheck"
    :prompts="handoff.prompts"
    :command="handoff.command"
  />
</template>

<style scoped>
.recheck[aria-disabled='true'] {
  cursor: default;
  opacity: 0.55;
}
</style>
