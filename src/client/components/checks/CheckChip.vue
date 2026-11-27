<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { CheckView } from '#core/check.ts'
import HintTooltip from '@/components/common/HintTooltip.vue'
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
</script>

<template>
  <span class="check-chip-host">
    <HintTooltip :text="checkChipHint(check)">
      <RouterLink
        v-if="proposalRoute"
        class="check-chip"
        :class="check.state"
        :to="proposalRoute"
        :tabindex="focusable ? undefined : -1"
        :data-check-state="check.state"
        @click.stop
      >
        {{ label }}
      </RouterLink>
      <span
        v-else
        class="check-chip"
        :class="check.state"
        :tabindex="focusable ? 0 : undefined"
        :data-check-state="check.state"
      >
        <span v-if="check.state === 'running'" class="dot" aria-hidden="true" />
        {{ label }}
      </span>
    </HintTooltip>
  </span>
</template>

<style scoped>
.check-chip-host {
  display: inline-flex;
  vertical-align: middle;
}

.check-chip {
  --check-color: var(--color-text-muted);
  --check-wash: transparent;

  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-1);
  height: var(--chip-height);
  padding: 0 var(--space-1-5);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--check-wash);
  color: var(--check-color);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
}

.running {
  --check-color: var(--color-claim);
  --check-wash: var(--color-claim-wash);

  border-color: color-mix(in srgb, var(--check-color) 60%, transparent);
}

.failed {
  --check-color: var(--color-danger);
  --check-wash: var(--color-danger-wash);

  border-color: transparent;
}

.done {
  --check-color: var(--color-success);
  --check-wash: var(--color-success-wash);

  border-color: transparent;
}

a.check-chip:hover {
  border-color: var(--check-color);
}

.dot {
  width: var(--dot-size);
  height: var(--dot-size);
  border-radius: var(--radius-pill);
  background: var(--check-color);
}
</style>
