<script setup lang="ts">
import { computed } from 'vue'

import type { ProposalView } from '#core/proposalView.ts'
import ClaudeText from '@/components/proposals/ClaudeText.vue'
import { fixPathRows } from '@/components/proposals/fixPathRows'
import { formatDate } from '@/format/relativeTime'

const props = defineProps<{
  proposal: ProposalView
  /** What to do shows the steps, effort and review date, this keeps only what it leaves out */
  planShown: boolean
}>()

const rows = computed(() => fixPathRows(props.proposal, props.planShown))
</script>

<template>
  <dl class="fix-and-review">
    <div v-if="rows.fixedVersion">
      <dt>Fixed version</dt>
      <dd>
        <span v-if="proposal.fix?.fixedVersion" class="mono">{{ proposal.fix.fixedVersion }}</span>
        <span v-else class="missing">Not stated</span>
      </dd>
    </div>
    <div v-if="rows.change && proposal.fix?.change">
      <dt>Change</dt>
      <dd><ClaudeText :text="proposal.fix.change" /></dd>
    </div>
    <div v-if="rows.effort">
      <dt>Effort</dt>
      <dd>
        <span v-if="proposal.fix?.effort">{{ proposal.fix.effort }}</span>
        <span v-else class="missing">Not stated</span>
      </dd>
    </div>
    <div v-if="planShown">
      <dt>Review reason</dt>
      <dd>
        <ClaudeText v-if="proposal.review?.why" :text="proposal.review.why" />
        <span v-else class="missing">Not stated</span>
      </dd>
    </div>
    <div v-else>
      <dt>Review by</dt>
      <dd>
        {{ proposal.review?.date ? formatDate(proposal.review.date) : 'No date proposed' }}
        <ClaudeText v-if="proposal.review?.why" class="why" :text="proposal.review.why" />
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.fix-and-review {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(var(--space-base) * 40), 1fr));
  gap: var(--space-2) var(--space-4);
  margin: 0;
  font-size: var(--font-size-sm);
}

.fix-and-review dt {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}

.fix-and-review dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.mono {
  font-family: var(--font-mono);
}

.why {
  margin-top: var(--space-0-5);
  color: var(--color-text-muted);
}

.missing {
  color: var(--color-text-subtle);
}
</style>
