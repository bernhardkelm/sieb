<script setup lang="ts">
import type { ProposalDetail } from '#core/apiTypes.ts'
import KevDetails from '@/components/finding/KevDetails.vue'
import AcceptEffects from '@/components/proposals/AcceptEffects.vue'
import ClaimBox from '@/components/proposals/ClaimBox.vue'
import ClaudeClaims from '@/components/proposals/ClaudeClaims.vue'
import ClaudeText from '@/components/proposals/ClaudeText.vue'
import EvidenceBasis from '@/components/proposals/EvidenceBasis.vue'
import EvidenceChecklist from '@/components/proposals/EvidenceChecklist.vue'
import FixAndReview from '@/components/proposals/FixAndReview.vue'
import ProposalHeader from '@/components/proposals/ProposalHeader.vue'
import ReferenceLinks from '@/components/proposals/ReferenceLinks.vue'
import SiebFacts from '@/components/proposals/SiebFacts.vue'
import UnknownsList from '@/components/proposals/UnknownsList.vue'

defineProps<{
  detail: ProposalDetail
}>()
</script>

<template>
  <div class="proposal-sections">
    <ProposalHeader :detail="detail" />
    <section class="section" aria-labelledby="review-summary">
      <h3 id="review-summary" class="section-title">Summary</h3>
      <ClaimBox>
        <ClaudeText :text="detail.proposal.summary" class="summary" />
      </ClaimBox>
    </section>
    <section class="section" aria-labelledby="review-basis">
      <h3 id="review-basis" class="section-title">Evidence basis</h3>
      <EvidenceBasis :detail="detail" />
    </section>
    <section class="section" aria-labelledby="review-facts">
      <h3 id="review-facts" class="section-title">sieb's facts and Claude's claims</h3>
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
      <h3 id="review-evidence" class="section-title">Evidence</h3>
      <ClaimBox>
        <EvidenceChecklist :evidence="detail.proposal.evidence" />
      </ClaimBox>
    </section>
    <section class="section" aria-labelledby="review-fix">
      <h3 id="review-fix" class="section-title">Fix path and review</h3>
      <ClaimBox>
        <FixAndReview :proposal="detail.proposal" />
      </ClaimBox>
    </section>
    <section class="section" aria-labelledby="review-unknowns">
      <h3 id="review-unknowns" class="section-title">
        Unknowns <span class="count">{{ detail.proposal.unknowns.length }}</span>
      </h3>
      <UnknownsList :unknowns="detail.proposal.unknowns" />
    </section>
    <section class="section" aria-labelledby="review-references">
      <h3 id="review-references" class="section-title">References</h3>
      <ReferenceLinks :references="detail.proposal.references" />
    </section>
    <section
      v-if="detail.proposal.state === 'open'"
      class="section"
      aria-labelledby="review-effects"
    >
      <h3 id="review-effects" class="section-title">What accepting will do</h3>
      <AcceptEffects :detail="detail" />
    </section>
  </div>
</template>

<style scoped>
.proposal-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-title {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
}

.count {
  color: var(--color-text-subtle);
  font-weight: var(--font-weight-regular);
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
