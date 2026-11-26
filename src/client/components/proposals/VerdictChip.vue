<script setup lang="ts">
import { computed } from 'vue'

import type { DecisionJustification } from '#core/decision.ts'
import type { ProposalVerdict } from '#core/proposal.ts'
import { verdictLabel } from '@/components/proposals/proposalText'

const props = withDefaults(
  defineProps<{
    verdict: ProposalVerdict
    justification?: DecisionJustification | null
    /** Large for the review header, small for rows and notices */
    size?: 'lg' | 'sm'
  }>(),
  { justification: null, size: 'sm' },
)

const label = computed(() => verdictLabel(props.verdict, props.justification))
</script>

<template>
  <span class="verdict-chip" :class="[verdict, size]">{{ label }}</span>
</template>

<style scoped>
.verdict-chip {
  --verdict-color: var(--color-text-muted);
  --verdict-wash: var(--color-severity-unknown-wash);

  display: inline-flex;
  align-items: center;
  max-width: 100%;
  border: var(--border-width) solid color-mix(in srgb, var(--verdict-color) 35%, transparent);
  border-radius: var(--radius);
  background: var(--verdict-wash);
  color: var(--verdict-color);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
}

.sm {
  min-height: var(--chip-height);
  padding: 0 var(--space-1-5);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.lg {
  padding: var(--space-1-5) var(--space-3);
  font-size: var(--font-size-lg);
  overflow-wrap: anywhere;
}

.not_affected {
  --verdict-color: var(--color-success);
  --verdict-wash: var(--color-success-wash);
}

.accepted {
  --verdict-color: var(--color-warning);
  --verdict-wash: var(--color-warning-wash);
}

.fix_planned {
  --verdict-color: var(--color-accent);
  --verdict-wash: var(--color-accent-wash);
}

.needs_patch {
  --verdict-color: var(--color-danger);
  --verdict-wash: var(--color-danger-wash);
}
</style>
