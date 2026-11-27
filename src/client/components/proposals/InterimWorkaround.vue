<script setup lang="ts">
import { useId } from 'vue'

import type { ProposalInterim } from '#core/proposal.ts'
import CopyButton from '@/components/common/CopyButton.vue'
import ClaudeText from '@/components/proposals/ClaudeText.vue'

defineProps<{
  /** Claude-written manual workaround, never rendered as HTML */
  interim: ProposalInterim
}>()

const id = useId()
</script>

<template>
  <aside class="interim-workaround" :aria-labelledby="`${id}-title`">
    <p :id="`${id}-title`" class="title">
      <strong>Urgent: manual workaround advised.</strong> No upstream fix exists yet.
    </p>
    <p class="action">
      <span class="text">{{ interim.action }}</span>
      <CopyButton :value="interim.action" label="Copy workaround" />
    </p>
    <ClaudeText v-if="interim.steps" :text="interim.steps" />
    <div class="caveats">
      <span class="label">Caveats</span>
      <ClaudeText :text="interim.caveats" />
    </div>
  </aside>
</template>

<style scoped>
.interim-workaround {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-warning);
  border-left-width: var(--border-width-strong);
  border-radius: var(--radius);
  background: var(--color-warning-wash);
  font-size: var(--font-size-sm);
}

.title {
  color: var(--color-warning);
}

.action {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.text {
  min-width: 0;
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}

.caveats {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
}

.label {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}
</style>
