<script setup lang="ts">
import type { ProposalDetail } from '#core/proposalApiTypes.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import BlockableButton from '@/components/common/BlockableButton.vue'
import HandoffButton from '@/components/finding/HandoffButton.vue'
import { useProposalRecheck } from '@/composables/useProposalRecheck'

const props = defineProps<{
  detail: ProposalDetail
}>()

const { mode, blockedBy, submitting, handoff, run } = useProposalRecheck(() => props.detail)
</script>

<template>
  <BlockableButton
    v-if="mode === 'auto'"
    :as="BaseButton"
    class="recheck"
    :blocked-by="blockedBy"
    blocked-title="No Auto-check queued"
    :busy="submitting"
    hint="Queue an Auto-check of the target findings, it files a new proposal"
    @press="run()"
  >
    Re-check
  </BlockableButton>
  <HandoffButton
    v-else-if="handoff"
    class="recheck"
    :prompts="handoff.prompts"
    :command="handoff.command"
  />
</template>
