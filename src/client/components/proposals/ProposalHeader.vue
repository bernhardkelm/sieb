<script setup lang="ts">
import { computed } from 'vue'

import type { ProposalDetail } from '#core/apiTypes.ts'
import { patchActionOf } from '#core/patchAction.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import KevChip from '@/components/chips/KevChip.vue'
import SeverityChip from '@/components/chips/SeverityChip.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import ConfidenceChip from '@/components/proposals/ConfidenceChip.vue'
import PatchAction from '@/components/proposals/PatchAction.vue'
import VerdictChip from '@/components/proposals/VerdictChip.vue'
import { proposerLine, resolutionLine } from '@/components/proposals/proposalText'
import { countOf } from '@/format/count'
import { PROPOSAL_STATE_LABELS } from '@/format/proposalLabels'
import { SCOPE_LABELS } from '@/format/labels'

const props = defineProps<{
  detail: ProposalDetail
}>()

const patchAction = computed(() => patchActionOf(props.detail.proposal))
</script>

<template>
  <div class="proposal-header">
    <div class="facts">
      <SeverityChip :severity="detail.severity" />
      <KevChip v-if="detail.kev" />
      <span class="images">
        {{ countOf(detail.imageCount, 'image') }} affected
        <template v-if="detail.proposal.scope === 'all'"> · {{ SCOPE_LABELS.all }}</template>
      </span>
    </div>
    <div class="claim">
      <span class="claim-label">Claude's verdict</span>
      <div class="verdict">
        <VerdictChip
          :verdict="detail.proposal.verdict"
          :justification="detail.proposal.justification"
          size="lg"
        />
        <ConfidenceChip :confidence="detail.proposal.confidence" />
      </div>
      <PatchAction
        v-if="patchAction"
        :action="patchAction"
        :layer="detail.proposal.fix?.layer ?? null"
        :fixed-version="detail.proposal.fix?.fixedVersion ?? null"
      />
    </div>
    <p class="proposer">
      {{ proposerLine(detail.proposal) }} ·
      <RelativeTime :value="detail.proposal.createdAt" />
    </p>
    <p v-if="detail.proposal.state !== 'open'" class="state" role="status">
      <BaseChip :tone="detail.proposal.state === 'accepted' ? 'success' : 'neutral'" outline>
        {{ PROPOSAL_STATE_LABELS[detail.proposal.state] }}
      </BaseChip>
      <span>
        {{ resolutionLine(detail.proposal) }}
        <template v-if="detail.proposal.resolvedAt">
          · <RelativeTime :value="detail.proposal.resolvedAt" />
        </template>
      </span>
    </p>
    <p v-if="detail.proposal.state === 'rejected' && detail.proposal.resolutionNote" class="note">
      {{ detail.proposal.resolutionNote }}
    </p>
    <p v-if="detail.outdated" class="outdated" role="alert">
      <BaseChip tone="warning">Outdated</BaseChip>
      A decision on this target changed since Claude filed this. Check the current decisions below.
    </p>
  </div>
</template>

<style scoped>
.proposal-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.facts,
.verdict,
.state,
.outdated {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.images {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.claim {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.claim-label {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
}

.proposer,
.state {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.note {
  padding-left: var(--space-3);
  border-left: var(--border-width-strong) solid var(--color-border-strong);
  color: var(--color-text-muted);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.outdated {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  background: var(--color-warning-wash);
  font-size: var(--font-size-sm);
}
</style>
