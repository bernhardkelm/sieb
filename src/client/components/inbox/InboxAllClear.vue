<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { EXPIRING_WITHIN_DAYS } from '#core/decisionFilter.ts'

import AllClear from '@/components/common/AllClear.vue'
import { countExpiringDecisions } from '@/components/inbox/expiringDecisions'
import { DECISION_TAB_QUERY, ROUTE_NAMES } from '@/router/routeNames'
import { useFindingsStore } from '@/stores/findingsStore'

const store = useFindingsStore()

const expiring = computed(() => countExpiringDecisions(store.items, store.now))
</script>

<template>
  <AllClear title="All clear">
    Every finding is decided. Nothing is waiting for you.
    <template #actions>
      <RouterLink class="action" :to="{ name: ROUTE_NAMES.DECISIONS }">Review decisions</RouterLink>
      <RouterLink
        v-if="expiring > 0"
        class="action"
        :to="{ name: ROUTE_NAMES.DECISIONS, query: { [DECISION_TAB_QUERY]: 'expiring' } }"
      >
        {{ expiring === 1 ? '1 decision expires' : `${expiring} decisions expire` }} within
        {{ EXPIRING_WITHIN_DAYS }} days
      </RouterLink>
    </template>
  </AllClear>
</template>

<style scoped>
.action {
  display: inline-flex;
  align-items: center;
  padding: var(--space-0-5) var(--space-1-5);
  border-radius: var(--radius);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: color var(--duration-fast) var(--ease);
}

.action:hover {
  color: var(--color-accent);
}

@media (hover: none) and (pointer: coarse) {
  .action {
    min-height: var(--control-height);
  }
}
</style>
