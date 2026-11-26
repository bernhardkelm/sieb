<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import { EXPIRING_WITHIN_DAYS, isExpiring } from '#core/decisionFilter.ts'

import AllClear from '@/components/common/AllClear.vue'
import { useNow } from '@/composables/useNow'
import { DECISION_TAB_QUERY, ROUTE_NAMES } from '@/router/routeNames'
import { useDecisionsStore } from '@/stores/decisionsStore'

const decisions = useDecisionsStore()
const now = useNow()

const expiring = computed(
  () => decisions.items.filter((view) => isExpiring(view, now.value)).length,
)

onMounted(() => {
  void decisions.ensureLoaded()
})
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
