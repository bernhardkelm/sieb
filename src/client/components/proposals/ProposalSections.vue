<script setup lang="ts">
import { computed } from 'vue'

import type { ProposalDetail } from '#core/proposalApiTypes.ts'
import { isDecidableVerdict } from '#core/proposal.ts'
import SectionHeading from '@/components/common/SectionHeading.vue'
import KevDetails from '@/components/finding/KevDetails.vue'
import AcceptEffects from '@/components/proposals/AcceptEffects.vue'
import ClaimBox from '@/components/proposals/ClaimBox.vue'
import ClaudeClaims from '@/components/proposals/ClaudeClaims.vue'
import ClaudeText from '@/components/proposals/ClaudeText.vue'
import EvidenceBasis from '@/components/proposals/EvidenceBasis.vue'
import EvidenceChecklist from '@/components/proposals/EvidenceChecklist.vue'
import FixAndReview from '@/components/proposals/FixAndReview.vue'
import MissingList from '@/components/proposals/MissingList.vue'
import ProposalHeader from '@/components/proposals/ProposalHeader.vue'
import { fixPathTitle } from '@/components/proposals/fixPathRows'
import { hasWhatToDo } from '@/components/proposals/proposalText'
import ReferenceLinks from '@/components/proposals/ReferenceLinks.vue'
import RelatedFindings from '@/components/proposals/RelatedFindings.vue'
import SiebFacts from '@/components/proposals/SiebFacts.vue'
import UnknownsList from '@/components/proposals/UnknownsList.vue'
import WhatToDo from '@/components/proposals/WhatToDo.vue'

const props = defineProps<{
  detail: ProposalDetail
}>()

const decidable = computed(() => isDecidableVerdict(props.detail.proposal.verdict))
const planShown = computed(() => hasWhatToDo(props.detail.proposal))
const fixTitle = computed(() => fixPathTitle(props.detail.proposal, planShown.value))
const relatedShown = computed(() => props.detail.related.length > 0)
const relatedAfterPlan = computed(() => decidable.value && planShown.value)
</script>

<template>
  <div class="proposal-sections">
    <ProposalHeader :detail="detail" />
    <section class="section" aria-labelledby="review-summary">
      <SectionHeading id="review-summary">Summary</SectionHeading>
      <ClaimBox>
        <ClaudeText :text="detail.proposal.summary" class="summary" />
      </ClaimBox>
    </section>
    <section v-if="!decidable" class="section" aria-labelledby="review-missing">
      <SectionHeading id="review-missing">Missing to decide</SectionHeading>
      <MissingList :missing="detail.proposal.missing" />
    </section>
    <section v-else-if="planShown" class="section" aria-labelledby="review-todo">
      <SectionHeading id="review-todo">What to do</SectionHeading>
      <ClaimBox>
        <WhatToDo :proposal="detail.proposal" />
      </ClaimBox>
    </section>
    <RelatedFindings v-if="relatedShown && relatedAfterPlan" :detail="detail" />
    <section class="section" aria-labelledby="review-basis">
      <SectionHeading id="review-basis">Evidence basis</SectionHeading>
      <EvidenceBasis :detail="detail" />
    </section>
    <section class="section" aria-labelledby="review-facts">
      <SectionHeading id="review-facts">sieb's facts and Claude's claims</SectionHeading>
      <div class="side-by-side">
        <div class="facts-column">
          <SiebFacts :detail="detail" />
          <div v-if="detail.kevCatalog" class="kev">
            <p class="kev-title">Known exploited, CISA catalog</p>
            <KevDetails :details="detail.kevCatalog" />
          </div>
        </div>
        <ClaudeClaims :proposal="detail.proposal" />
      </div>
    </section>
    <section class="section" aria-labelledby="review-evidence">
      <SectionHeading id="review-evidence">Evidence</SectionHeading>
      <ClaimBox>
        <EvidenceChecklist :evidence="detail.proposal.evidence" />
      </ClaimBox>
    </section>
    <RelatedFindings v-if="relatedShown && !relatedAfterPlan" :detail="detail" />
    <section class="section" aria-labelledby="review-fix">
      <SectionHeading id="review-fix">{{ fixTitle }}</SectionHeading>
      <ClaimBox>
        <FixAndReview :proposal="detail.proposal" :plan-shown="planShown" />
      </ClaimBox>
    </section>
    <section class="section" aria-labelledby="review-unknowns">
      <SectionHeading id="review-unknowns" :count="detail.proposal.unknowns.length">
        Unknowns
      </SectionHeading>
      <UnknownsList :unknowns="detail.proposal.unknowns" />
    </section>
    <section class="section" aria-labelledby="review-references">
      <SectionHeading id="review-references">References</SectionHeading>
      <ReferenceLinks :references="detail.proposal.references" />
    </section>
    <section
      v-if="detail.proposal.state === 'open' && decidable"
      class="section"
      aria-labelledby="review-effects"
    >
      <SectionHeading id="review-effects">What accepting will do</SectionHeading>
      <AcceptEffects :detail="detail" />
    </section>
  </div>
</template>

<style scoped src="@/components/layout/panelSection.css"></style>

<style scoped>
.proposal-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.summary {
  font-size: var(--font-size-lg);
  line-height: var(--line-height-body);
}

.side-by-side {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(var(--space-base) * 72), 1fr));
  gap: var(--space-3);
  align-items: start;
}

.facts-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.kev-title {
  margin-bottom: var(--space-1);
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}

.kev {
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius);
}
</style>
