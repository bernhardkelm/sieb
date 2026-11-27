<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ProposalDetail } from '#core/proposalApiTypes.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import SectionHeading from '@/components/common/SectionHeading.vue'
import BulkDecisionDialog from '@/components/decision/BulkDecisionDialog.vue'
import BulkActionButton from '@/components/list/BulkActionButton.vue'
import ClaimBox from '@/components/proposals/ClaimBox.vue'
import ClaudeText from '@/components/proposals/ClaudeText.vue'
import RelatedFindingRow from '@/components/proposals/RelatedFindingRow.vue'
import { useRelatedFindingActions } from '@/composables/useRelatedFindingActions'
import { FINDING_NOUN } from '@/format/bulkCount'
import { countOf } from '@/format/count'
import { useChecksStore } from '@/stores/checksStore'

const props = defineProps<{
  detail: ProposalDetail
}>()

const checks = useChecksStore()
const actions = useRelatedFindingActions(() => props.detail)
const deciding = ref(false)
const title = computed(() => `Same cause, ${countOf(props.detail.related.length, 'more finding')}`)
</script>

<template>
  <section class="related-findings section" aria-labelledby="review-related">
    <SectionHeading id="review-related">{{ title }}</SectionHeading>
    <ClaimBox v-if="detail.proposal.relatedReason">
      <ClaudeText :text="detail.proposal.relatedReason" />
    </ClaimBox>
    <ul class="rows">
      <RelatedFindingRow v-for="facts in detail.related" :key="facts.findingId" :facts="facts" />
    </ul>
    <p class="hint">Accepting decides only the proposal's own target, these stay separate.</p>
    <div class="actions">
      <BulkActionButton
        class="decide"
        :as="BaseButton"
        label="Decide the same way"
        template="Decide {n} the same way"
        :count="actions.decideCount.value"
        :noun="FINDING_NOUN"
        :blocked-by="actions.decideBlockedBy.value"
        blocked-title="Nothing to decide"
        @press="deciding = true"
      />
      <BulkActionButton
        v-if="checks.enabled"
        class="auto-check"
        :as="BaseButton"
        label="Auto-check"
        :count="actions.checkCount.value"
        :noun="FINDING_NOUN"
        :blocked-by="actions.checkBlockedBy.value"
        blocked-title="No Auto-check queued"
        hint="Queue an Auto-check per open, undecided finding of the same cause"
        @press="actions.runCheck()"
      />
    </div>
    <BulkDecisionDialog
      v-model:open="deciding"
      :targets="actions.targets.value"
      :prefill="actions.prefill.value"
    />
  </section>
</template>

<style scoped src="@/components/layout/panelSection.css"></style>

<style scoped>
.rows {
  margin: 0;
  padding: 0;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  list-style: none;
}

.rows > :not(:last-child) {
  border-bottom: var(--border-width) solid var(--color-border);
}

.hint {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
