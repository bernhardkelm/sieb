<script setup lang="ts">
import { computed } from 'vue'

import { patchActionOf } from '#core/patchAction.ts'
import { isUpstreamPendingFix } from '#core/proposalFixUpstream.ts'
import type { ProposalView } from '#core/proposalView.ts'
import ClaudeText from '@/components/proposals/ClaudeText.vue'
import InterimWorkaround from '@/components/proposals/InterimWorkaround.vue'
import PatchAction from '@/components/proposals/PatchAction.vue'
import UpstreamWait from '@/components/proposals/UpstreamWait.vue'
import { formatDate } from '@/format/relativeTime'

const props = defineProps<{
  proposal: ProposalView
}>()

const action = computed(() => patchActionOf(props.proposal))
const upstream = computed(() => isUpstreamPendingFix(props.proposal))
</script>

<template>
  <div class="what-to-do">
    <UpstreamWait
      v-if="upstream"
      :waiting-for="proposal.fix?.waitingFor ?? null"
      :review-date="proposal.review?.date ?? null"
    />
    <PatchAction
      v-else-if="action"
      :action="action"
      :layer="proposal.fix?.layer ?? null"
      :fixed-version="proposal.fix?.fixedVersion ?? null"
    />
    <p v-if="upstream && action" class="action">{{ action }}</p>
    <ClaudeText v-if="proposal.fix?.change" class="steps" :text="proposal.fix.change" />
    <dl class="plan">
      <div>
        <dt>Effort</dt>
        <dd>
          <span v-if="proposal.fix?.effort">{{ proposal.fix.effort }}</span>
          <span v-else class="missing">Not stated</span>
        </dd>
      </div>
      <div v-if="!upstream">
        <dt>Review by</dt>
        <dd>
          {{ proposal.review?.date ? formatDate(proposal.review.date) : 'No date proposed' }}
        </dd>
      </div>
    </dl>
    <InterimWorkaround v-if="upstream && proposal.fix?.interim" :interim="proposal.fix.interim" />
  </div>
</template>

<style scoped>
.what-to-do {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.action {
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
}

.plan {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(var(--space-base) * 40), 1fr));
  gap: var(--space-2) var(--space-4);
  margin: 0;
  font-size: var(--font-size-sm);
}

.plan dt {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}

.plan dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.missing {
  color: var(--color-text-subtle);
}
</style>
