<script setup lang="ts">
import { computed } from 'vue'

import type { ProposalDetail } from '#core/proposalApiTypes.ts'
import { EVIDENCE_BASES } from '#core/proposal.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import CalloutBox from '@/components/common/CalloutBox.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
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
          <BaseChip
            class="badge"
            :class="{ checked }"
            :tone="checked ? 'accent' : 'neutral'"
            :variant="checked ? 'framed' : 'pending'"
            focusable
            :data-basis="basis"
          >
            <AppIcon class="mark" :name="checked ? 'check' : 'circle'" />
            {{ EVIDENCE_BASIS_LABELS[basis] }}
            <span class="visually-hidden">{{ checked ? 'checked' : 'not checked' }}</span>
          </BaseChip>
        </HintTooltip>
      </li>
    </ul>
    <CalloutBox v-if="weak" as="p" tone="danger" class="weak" role="alert">
      <strong>Weak evidence: only the advisory was checked.</strong>
      Claude says not affected without looking at the code, the image or the runtime.
    </CalloutBox>
    <CalloutBox v-if="privateImages.length > 0" as="p" tone="warning" class="private" role="alert">
      <strong>Claude could not inspect the source of a private image.</strong>
      {{ privateImages.map(shortImageName).join(', ') }}: the own source is not in the evidence
      basis.
    </CalloutBox>
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

.mark {
  --icon-size: var(--chip-icon-size);
  --icon-stroke: var(--icon-stroke-bold);
}
</style>
