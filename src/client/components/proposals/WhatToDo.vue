<script setup lang="ts">
import { computed } from 'vue'

import { patchActionOf } from '#core/patchAction.ts'
import type { ProposalView } from '#core/proposalView.ts'
import ClaudeText from '@/components/proposals/ClaudeText.vue'
import PatchAction from '@/components/proposals/PatchAction.vue'
import { formatDate } from '@/format/relativeTime'

const props = defineProps<{
  proposal: ProposalView
}>()

const action = computed(() => patchActionOf(props.proposal))
</script>

<template>
  <div class="what-to-do">
    <PatchAction
      v-if="action"
      :action="action"
      :layer="proposal.fix?.layer ?? null"
      :fixed-version="proposal.fix?.fixedVersion ?? null"
    />
    <ClaudeText v-if="proposal.fix?.change" class="steps" :text="proposal.fix.change" />
    <dl class="plan">
      <div>
        <dt>Effort</dt>
        <dd>
          <span v-if="proposal.fix?.effort">{{ proposal.fix.effort }}</span>
          <span v-else class="missing">Not stated</span>
        </dd>
      </div>
      <div>
        <dt>Review by</dt>
        <dd>
          {{ proposal.review?.date ? formatDate(proposal.review.date) : 'No date proposed' }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.what-to-do {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
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
