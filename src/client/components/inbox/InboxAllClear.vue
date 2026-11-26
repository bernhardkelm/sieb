<script setup lang="ts">
import { RouterLink } from 'vue-router'

import AllClear from '@/components/common/AllClear.vue'
import { ROUTE_NAMES } from '@/router/routeNames'
</script>

<template>
  <AllClear title="Inbox zero">
    Nothing waits for you.
    <template #actions>
      <RouterLink :to="{ name: ROUTE_NAMES.TRIAGE }">Open Triage</RouterLink>
      <RouterLink :to="{ name: ROUTE_NAMES.DECISIONS }">Review decisions</RouterLink>
    </template>
  </AllClear>
</template>
