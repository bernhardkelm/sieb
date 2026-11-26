<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import RelativeTime from '@/components/common/RelativeTime.vue'
import ClaimBox from '@/components/proposals/ClaimBox.vue'
import ConfidenceChip from '@/components/proposals/ConfidenceChip.vue'
import VerdictChip from '@/components/proposals/VerdictChip.vue'
import { proposerLine } from '@/components/proposals/proposalText'
import { PROPOSAL_PARAM, ROUTE_NAMES } from '@/router/routeNames'
import { useProposalsStore } from '@/stores/proposalsStore'

const props = defineProps<{
  vulnId: string
  imageRef: string
}>()

const proposals = useProposalsStore()
const items = computed(() => proposals.openFor(props.vulnId, props.imageRef))

onMounted(() => {
  void proposals.ensureLoaded()
})
</script>

<template>
  <ClaimBox
    v-for="{ proposal, outdated } in items"
    :key="proposal.id"
    tag="Claude proposed"
    class="proposal-notice"
    :data-proposal-id="proposal.id"
  >
    <div class="line">
      <VerdictChip :verdict="proposal.verdict" :justification="proposal.justification" />
      <ConfidenceChip :confidence="proposal.confidence" />
      <span v-if="outdated" class="outdated">outdated</span>
      <RouterLink
        class="open"
        :to="{
          name: ROUTE_NAMES.INBOX_PROPOSAL,
          params: { [PROPOSAL_PARAM]: String(proposal.id) },
        }"
        >Open review →</RouterLink
      >
    </div>
    <p class="meta">{{ proposerLine(proposal) }} · <RelativeTime :value="proposal.createdAt" /></p>
  </ClaimBox>
</template>

<style scoped>
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.open {
  margin-left: auto;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.outdated {
  color: var(--color-warning);
  font-size: var(--font-size-sm);
}

.meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
