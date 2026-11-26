<script setup lang="ts">
import type { DecisionView } from '#core/findingView.ts'
import DecisionStateChip from '@/components/chips/DecisionStateChip.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import { countOf } from '@/format/count'
import { JUSTIFICATION_LABELS, SCOPE_LABELS } from '@/format/labels'
import { formatDate } from '@/format/relativeTime'
import { RECONFIRM_HINT, reopenText } from '@/format/reopenText'

defineProps<{
  view: DecisionView
  /** Marks the decision that decides the finding when several apply */
  governing?: boolean
  /** Disables the re-confirm action while a re-confirm is in flight */
  busy?: boolean
}>()

defineEmits<{ edit: []; revoke: []; reconfirm: [] }>()
</script>

<template>
  <article class="decision-card" :class="{ governing }">
    <header class="head">
      <DecisionStateChip
        :effective="view.effective"
        :status="view.decision.status"
        :justification="view.decision.justification"
      />
      <span class="scope">{{ SCOPE_LABELS[view.decision.scope] }}</span>
      <span v-if="governing" class="governing-label">governs this finding</span>
      <span class="actions">
        <BaseButton
          v-if="view.effective.state === 'reopened'"
          variant="primary"
          :disabled="busy"
          @click="$emit('reconfirm')"
        >
          Re-confirm
        </BaseButton>
        <BaseButton variant="ghost" @click="$emit('edit')">Edit</BaseButton>
        <BaseButton variant="ghost" @click="$emit('revoke')">Revoke</BaseButton>
      </span>
    </header>
    <p v-if="view.effective.state === 'reopened'" class="why" role="note">
      {{ reopenText(view.effective) }}. {{ RECONFIRM_HINT }}
    </p>
    <p v-if="view.decision.justification" class="justification">
      Justification: {{ JUSTIFICATION_LABELS[view.decision.justification] }}
    </p>
    <p class="reason">{{ view.decision.reason }}</p>
    <p class="meta">
      {{ view.decision.createdBy }} · <RelativeTime :value="view.decision.updatedAt" /> ·
      {{
        view.decision.expiresAt ? `expires ${formatDate(view.decision.expiresAt)}` : 'never expires'
      }}
      <template v-if="view.decision.scope === 'all'">
        · {{ countOf(view.openFindings, 'open finding') }}</template
      >
    </p>
  </article>
</template>

<style scoped>
.decision-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
}

.governing {
  border-color: var(--color-border-strong);
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.scope,
.governing-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.actions {
  display: flex;
  gap: var(--space-1);
  margin-left: auto;
}

.why {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.justification {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.reason {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.meta {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}
</style>
