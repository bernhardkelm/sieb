<script setup lang="ts">
import { computed, onMounted } from 'vue'

import HintTooltip from '@/components/common/HintTooltip.vue'
import { proposerLine, verdictLabel } from '@/components/proposals/proposalText'
import { VERDICT_LABELS } from '@/format/proposalLabels'
import { useProposalsStore } from '@/stores/proposalsStore'

const props = defineProps<{
  vulnId: string
  imageRef: string
}>()

const proposals = useProposalsStore()
const newest = computed(() => proposals.openFor(props.vulnId, props.imageRef)[0] ?? null)
const hint = computed(() =>
  newest.value === null
    ? ''
    : `${proposerLine(newest.value.proposal)}: ${verdictLabel(newest.value.proposal.verdict, newest.value.proposal.justification)}`,
)

onMounted(() => {
  void proposals.ensureLoaded()
})
</script>

<template>
  <span v-if="newest" class="proposal-marker">
    <HintTooltip :text="hint">
      <span class="proposal-chip" :data-proposal-id="newest.proposal.id">
        Proposed · {{ VERDICT_LABELS[newest.proposal.verdict] }}
      </span>
    </HintTooltip>
  </span>
</template>

<style scoped>
.proposal-marker {
  display: inline-flex;
  vertical-align: middle;
}

.proposal-chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  height: var(--chip-height);
  padding: 0 var(--space-1-5);
  border: var(--border-width) dashed color-mix(in srgb, var(--color-claim) 60%, transparent);
  border-radius: var(--radius-sm);
  background: var(--color-claim-wash);
  color: var(--color-claim);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  white-space: nowrap;
}
</style>
