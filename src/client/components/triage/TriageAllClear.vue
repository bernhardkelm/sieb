<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { EXPIRING_WITHIN_DAYS } from '#core/decisionFilter.ts'

import AllClear from '@/components/common/AllClear.vue'
import { countExpiringDecisions } from '@/components/triage/expiringDecisions'
import { DECISION_TAB_QUERY, ROUTE_NAMES } from '@/router/routeNames'
import { useFindingsStore } from '@/stores/findingsStore'

const store = useFindingsStore()

const expiring = computed(() => countExpiringDecisions(store.items, store.now))
</script>

<template>
  <AllClear title="All clear">
    Every finding is decided, nothing is left to triage.
    <template #actions>
      <RouterLink :to="{ name: ROUTE_NAMES.DECISIONS }">Review decisions</RouterLink>
      <RouterLink
        v-if="expiring > 0"
        :to="{ name: ROUTE_NAMES.DECISIONS, query: { [DECISION_TAB_QUERY]: 'expiring' } }"
      >
        {{ expiring === 1 ? '1 decision expires' : `${expiring} decisions expire` }} within
        {{ EXPIRING_WITHIN_DAYS }} days
      </RouterLink>
    </template>
  </AllClear>
</template>
