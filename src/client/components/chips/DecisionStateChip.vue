<script setup lang="ts">
import { computed } from 'vue'

import type { DecisionJustification, DecisionStatus } from '#core/decision.ts'
import type { EffectiveDecision } from '#core/effectiveDecision.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import { DECISION_STATE_TONES } from '@/components/chips/chipTones'
import HintTooltip from '@/components/common/HintTooltip.vue'
import { JUSTIFICATION_LABELS, STATE_LABELS, STATUS_LABELS } from '@/format/labels'
import { formatAbsolute } from '@/format/relativeTime'
import { reopenText } from '@/format/reopenText'

const props = withDefaults(
  defineProps<{
    effective: EffectiveDecision
    /** Status of the decision, labels an active one as "Accepted" or "Not affected" */
    status?: DecisionStatus | null
    /** Justification of a not affected decision, appended to the tooltip */
    justification?: DecisionJustification | null
  }>(),
  { status: null, justification: null },
)

const ACTIVE_HINTS: Record<DecisionStatus, string> = {
  not_affected: 'Not affected, alerts muted',
  accepted: 'Risk accepted, alerts muted',
  fix_planned: 'Out of Triage, alerts keep firing',
}

const label = computed(() =>
  props.effective.state === 'active' && props.status
    ? STATUS_LABELS[props.status]
    : STATE_LABELS[props.effective.state],
)

const stateReason = computed(() => {
  const effective = props.effective

  switch (effective.state) {
    case 'active':
      return props.status ? ACTIVE_HINTS[props.status] : 'Alerts muted'
    case 'fix_planned':
      return 'Out of Triage, alerts keep firing'
    case 'expired':
      return `Expired ${formatAbsolute(effective.expiresAt)}`
    case 'revoked':
      return `Revoked ${formatAbsolute(effective.revokedAt)}`
    case 'reopened':
      return reopenText(effective)
  }

  return ''
})

const reason = computed(() =>
  props.justification
    ? `${stateReason.value}. Justification: ${JUSTIFICATION_LABELS[props.justification]}`
    : stateReason.value,
)
</script>

<template>
  <HintTooltip :text="reason">
    <BaseChip :tone="DECISION_STATE_TONES[effective.state]" variant="dot">
      {{ label }}
    </BaseChip>
  </HintTooltip>
</template>
