<script setup lang="ts">
import { computed } from 'vue'

import type { DecisionStatus } from '#core/decision.ts'
import type { EffectiveDecision } from '#core/effectiveDecision.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import type { ChipTone } from '@/components/chips/chipTone'
import HintTooltip from '@/components/common/HintTooltip.vue'
import { STATE_LABELS, STATUS_LABELS } from '@/format/labels'
import { formatAbsolute } from '@/format/relativeTime'
import { reopenText } from '@/format/reopenText'

const props = withDefaults(
  defineProps<{
    effective: EffectiveDecision
    /** Status of the decision, labels an active one as "Accepted" or "Not affected" */
    status?: DecisionStatus | null
  }>(),
  { status: null },
)

const TONES: Record<EffectiveDecision['state'], ChipTone> = {
  active: 'success',
  fix_planned: 'accent',
  expired: 'warning',
  revoked: 'neutral',
  reopened: 'danger',
}

const label = computed(() =>
  props.effective.state === 'active' && props.status
    ? STATUS_LABELS[props.status]
    : STATE_LABELS[props.effective.state],
)

const reason = computed(() => {
  const effective = props.effective

  switch (effective.state) {
    case 'active':
      return 'Silences alerts'
    case 'fix_planned':
      return 'Out of the inbox, alerts keep firing'
    case 'expired':
      return `Expired ${formatAbsolute(effective.expiresAt)}`
    case 'revoked':
      return `Revoked ${formatAbsolute(effective.revokedAt)}`
    case 'reopened':
      return reopenText(effective)
  }

  return ''
})
</script>

<template>
  <HintTooltip :text="reason">
    <BaseChip :tone="TONES[effective.state]" dot>{{ label }}</BaseChip>
  </HintTooltip>
</template>
