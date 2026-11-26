<script setup lang="ts">
import { computed } from 'vue'

import type { ProposalDetail } from '#core/apiTypes.ts'
import { EVIDENCE_BASES } from '#core/proposal.ts'
import HintTooltip from '@/components/common/HintTooltip.vue'
import { isWeakEvidence, uninspectedPrivateImages } from '@/components/proposals/proposalWarnings'
import { shortImageName } from '@/format/imageName'
import { EVIDENCE_BASIS_HINTS, EVIDENCE_BASIS_LABELS } from '@/format/proposalLabels'

const props = defineProps<{
  detail: ProposalDetail
}>()

const bases = computed(() =>
  EVIDENCE_BASES.map((basis) => ({
    basis,
    checked: props.detail.proposal.evidenceBasis.includes(basis),
  })),
)
const weak = computed(() => isWeakEvidence(props.detail))
const privateImages = computed(() => uninspectedPrivateImages(props.detail))
</script>

<template>
  <div class="evidence-basis">
    <ul class="badges" aria-label="What Claude checked">
      <li v-for="{ basis, checked } in bases" :key="basis">
        <HintTooltip :text="EVIDENCE_BASIS_HINTS[basis]">
          <span class="badge" :class="{ checked }" tabindex="0" :data-basis="basis">
            <span class="mark" aria-hidden="true">{{ checked ? '✓' : '○' }}</span>
            {{ EVIDENCE_BASIS_LABELS[basis] }}
            <span class="visually-hidden">{{ checked ? 'checked' : 'not checked' }}</span>
          </span>
        </HintTooltip>
      </li>
    </ul>
    <p v-if="weak" class="warning weak" role="alert">
      <strong>Weak evidence: only the advisory was checked.</strong>
      Claude says not affected without looking at the code, the image or the runtime.
    </p>
    <p v-if="privateImages.length > 0" class="warning private" role="alert">
      <strong>Claude could not inspect the source of a private image.</strong>
      {{ privateImages.map(shortImageName).join(', ') }}: the own source is not in the evidence
      basis.
    </p>
  </div>
</template>

<style scoped>
.evidence-basis {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: var(--chip-height);
  padding: 0 var(--space-1-5);
  border: var(--border-width) dashed var(--color-border-strong);
  border-radius: var(--radius-sm);
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.badge.checked {
  border-style: solid;
  border-color: color-mix(in srgb, var(--color-accent) 40%, transparent);
  background: var(--color-accent-wash);
  color: var(--color-text);
}

.badge:focus-visible {
  outline: var(--border-width-strong) solid var(--color-focus);
  outline-offset: var(--border-width);
}

.mark {
  color: var(--color-accent);
}

.badge:not(.checked) .mark {
  color: var(--color-text-subtle);
}

.warning {
  padding: var(--space-2) var(--space-3);
  border-left: var(--border-width-strong) solid var(--color-danger);
  border-radius: var(--radius-sm);
  background: var(--color-danger-wash);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

.warning.private {
  border-left-color: var(--color-warning);
  background: var(--color-warning-wash);
}
</style>
