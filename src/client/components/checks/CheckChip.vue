<script setup lang="ts">
import { computed } from 'vue'

import type { CheckView } from '#core/check.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import { CHECK_STATE_LOOKS } from '@/components/chips/chipTones'
import HintTooltip from '@/components/common/HintTooltip.vue'
import StatusDot from '@/components/common/StatusDot.vue'
import { useSecondClock } from '@/composables/useSecondClock'
import { checkChipHint, checkChipLabel } from '@/format/checkText'
import { PROPOSAL_PARAM, ROUTE_NAMES } from '@/router/routeNames'

const props = withDefaults(
  defineProps<{
    check: CheckView
    /** In the Tab order with its tooltip, list rows leave it out since the row is the option */
    focusable?: boolean
  }>(),
  { focusable: false },
)

const now = useSecondClock()
const label = computed(() => checkChipLabel(props.check, now.value))
const proposalRoute = computed(() =>
  props.check.state === 'done' && props.check.proposalId !== null
    ? { name: ROUTE_NAMES.INBOX_PROPOSAL, params: { [PROPOSAL_PARAM]: props.check.proposalId } }
    : null,
)

/**
 * Keeps a click on the proposal link from selecting the row behind it.
 * @param {MouseEvent} event - Click
 * @returns {void}
 */
const onClick = (event: MouseEvent): void => {
  if (proposalRoute.value !== null) {
    event.stopPropagation()
  }
}
</script>

<template>
  <span class="check-chip-host">
    <HintTooltip :text="checkChipHint(check)">
      <BaseChip
        class="check-chip"
        :tone="CHECK_STATE_LOOKS[check.state].tone"
        :variant="CHECK_STATE_LOOKS[check.state].variant"
        :to="proposalRoute"
        :focusable="focusable"
        :tabindex="proposalRoute && !focusable ? -1 : undefined"
        :data-check-state="check.state"
        @click="onClick"
      >
        <StatusDot v-if="check.state === 'running'" tone="claim" />
        {{ label }}
      </BaseChip>
    </HintTooltip>
  </span>
</template>

<style scoped>
.check-chip-host {
  display: inline-flex;
  vertical-align: middle;
}
</style>
