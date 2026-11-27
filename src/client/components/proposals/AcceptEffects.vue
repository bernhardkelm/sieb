<script setup lang="ts">
import { computed } from 'vue'

import type { ProposalDetail } from '#core/proposalApiTypes.ts'
import { acceptEffects } from '@/components/proposals/acceptEffects'

const props = defineProps<{
  detail: ProposalDetail
}>()

const effects = computed(() => acceptEffects(props.detail))
</script>

<template>
  <ul class="accept-effects">
    <li v-for="(effect, index) in effects" :key="index" class="effect" :class="effect.kind">
      {{ effect.text }}
    </li>
  </ul>
</template>

<style scoped>
.accept-effects {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius);
  list-style: none;
}

.effect {
  position: relative;
  padding-left: var(--space-4);
  overflow-wrap: anywhere;
}

.effect::before {
  position: absolute;
  top: calc(var(--line-height-body) * 0.5em - var(--dot-size) / 2);
  left: 0;
  width: var(--dot-size);
  height: var(--dot-size);
  border-radius: var(--radius-pill);
  background: var(--color-text-subtle);
  content: '';
}

.mute {
  font-weight: var(--font-weight-semibold);
}

.mute::before {
  background: var(--color-success);
}

.alerts::before {
  background: var(--color-accent);
}

.replace {
  color: var(--color-warning);
  font-weight: var(--font-weight-medium);
}

.replace::before {
  background: var(--color-warning);
}

.scope {
  font-weight: var(--font-weight-medium);
}

.scope::before {
  background: var(--color-warning);
}

.expiry {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
