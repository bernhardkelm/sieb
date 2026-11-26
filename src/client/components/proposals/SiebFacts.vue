<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ProposalDetail } from '#core/apiTypes.ts'
import DecisionStateChip from '@/components/chips/DecisionStateChip.vue'
import ImageFactsRow from '@/components/proposals/ImageFactsRow.vue'

const props = defineProps<{
  detail: ProposalDetail
}>()

const FIRST_IMAGES = 4

const showAll = ref(false)
const shown = computed(() =>
  showAll.value ? props.detail.images : props.detail.images.slice(0, FIRST_IMAGES),
)
const hidden = computed(() => props.detail.images.length - shown.value.length)
</script>

<template>
  <div class="sieb-facts">
    <p class="source">From sieb's scans and decisions</p>
    <p v-if="detail.allScopeDecision" class="all-scope">
      All-images decision:
      <DecisionStateChip
        :effective="detail.allScopeDecision.effective"
        :status="detail.allScopeDecision.decision.status"
        :justification="detail.allScopeDecision.decision.justification"
      />
    </p>
    <ul class="images" aria-label="Images">
      <ImageFactsRow v-for="image in shown" :key="image.imageRef" :image="image" />
    </ul>
    <p v-if="detail.images.length === 0" class="empty">No open finding left for this target.</p>
    <button v-if="hidden > 0" type="button" class="more" @click="showAll = true">
      Show {{ hidden }} more
    </button>
  </div>
</template>

<style scoped>
.sieb-facts {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) 0 0;
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.source,
.all-scope,
.empty,
.more {
  padding: 0 var(--space-3);
}

.source {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}

.all-scope {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.images {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.images > :deep(li + li) {
  border-top: var(--border-width) solid var(--color-border);
}

.empty {
  padding-bottom: var(--space-2);
  color: var(--color-text-subtle);
}

.more {
  align-self: flex-start;
  margin-bottom: var(--space-2);
  border: 0;
  background: none;
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.more:focus-visible {
  outline: var(--border-width-strong) solid var(--color-focus);
  border-radius: var(--radius-sm);
}
</style>
