<script setup lang="ts">
import type { ProposalEvidence } from '#core/proposal.ts'
import ClaudeText from '@/components/proposals/ClaudeText.vue'

defineProps<{
  evidence: ProposalEvidence[]
}>()
</script>

<template>
  <ol v-if="evidence.length > 0" class="evidence-checklist">
    <li v-for="(entry, index) in evidence" :key="index" class="entry">
      <p class="check">{{ entry.check }}</p>
      <dl class="detail">
        <div>
          <dt>Method</dt>
          <dd class="method"><ClaudeText :text="entry.method" /></dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd><ClaudeText :text="entry.result" /></dd>
        </div>
      </dl>
    </li>
  </ol>
  <p v-else class="none">No checks listed.</p>
</template>

<style scoped>
.evidence-checklist {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0 0 0 var(--space-5);
}

.entry {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.entry::marker {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}

.check {
  font-weight: var(--font-weight-medium);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  font-size: var(--font-size-sm);
}

.detail dt {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}

.detail dd {
  margin: 0;
}

.method {
  font-family: var(--font-mono);
}

.none {
  color: var(--color-warning);
  font-size: var(--font-size-sm);
}
</style>
