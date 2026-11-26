<script setup lang="ts">
import type { ProposalView } from '#core/proposalView.ts'
import ClaudeText from '@/components/proposals/ClaudeText.vue'
import { formatDate } from '@/format/relativeTime'

defineProps<{
  proposal: ProposalView
}>()
</script>

<template>
  <dl class="fix-and-review">
    <div>
      <dt>Fixed version</dt>
      <dd>
        <span v-if="proposal.fix?.fixedVersion" class="mono">{{ proposal.fix.fixedVersion }}</span>
        <span v-else class="missing">Not stated</span>
      </dd>
    </div>
    <div>
      <dt>Change</dt>
      <dd>
        <ClaudeText v-if="proposal.fix?.change" :text="proposal.fix.change" />
        <span v-else class="missing">Not stated</span>
      </dd>
    </div>
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
