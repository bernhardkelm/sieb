<script setup lang="ts">
import { computed } from 'vue'

import type { ProposalView } from '#core/proposalView.ts'
import ClaimBox from '@/components/proposals/ClaimBox.vue'
import ClaudeText from '@/components/proposals/ClaudeText.vue'

const props = defineProps<{
  proposal: ProposalView
}>()

const claims = computed(() =>
  [
    { key: 'presence', label: 'Presence', text: props.proposal.presence },
    { key: 'reachability', label: 'Reachability', text: props.proposal.reachability },
    { key: 'exposure', label: 'Exposure', text: props.proposal.exposure },
  ].map((claim) => ({ ...claim, text: claim.text?.trim() ?? '' })),
)
</script>

<template>
  <ClaimBox class="claude-claims">
    <dl class="claims">
      <div v-for="claim in claims" :key="claim.key" class="claim" :data-claim="claim.key">
        <dt>{{ claim.label }}</dt>
        <dd>
          <span v-if="claim.text === ''" class="missing">Not stated</span>
          <ClaudeText v-else :text="claim.text" />
        </dd>
      </div>
    </dl>
  </ClaimBox>
</template>

<style scoped>
.claims {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
}

.claim dt {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.claim dd {
  margin: 0;
}

.missing {
  color: var(--color-warning);
  font-size: var(--font-size-sm);
}
</style>
