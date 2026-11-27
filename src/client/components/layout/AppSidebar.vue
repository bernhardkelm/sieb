<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import SidebarHints from '@/components/layout/SidebarHints.vue'
import SidebarNav from '@/components/layout/SidebarNav.vue'
import SourceCodeLink from '@/components/layout/SourceCodeLink.vue'
import OverviewStats from '@/components/overview/OverviewStats.vue'
import { HOME_ROUTE } from '@/router/routeNames'
import { useChecksStore } from '@/stores/checksStore'
import { useInboxStore } from '@/stores/inboxStore'

const inbox = useInboxStore()
const checks = useChecksStore()

onMounted(() => {
  inbox.startPolling()
  checks.startPolling()
})

onBeforeUnmount(() => {
  inbox.stopPolling()
  checks.stopPolling()
})
</script>

<template>
  <div class="sidebar">
    <RouterLink class="wordmark" :to="{ name: HOME_ROUTE }" aria-label="sieb, home"
      >sieb</RouterLink
    >
    <SidebarNav />
    <OverviewStats class="overview" />
    <div class="foot">
      <SidebarHints />
      <SourceCodeLink class="source-code" />
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  padding: var(--space-3) var(--space-2);
  border-right: var(--border-width) solid var(--color-border);
  background: var(--color-sidebar);
}

.wordmark {
  align-self: flex-start;
  padding: 0 var(--space-2);
  border-radius: var(--radius);
  color: inherit;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  line-height: var(--control-height);
  text-decoration: none;
}

.foot {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: auto;
}

.source-code {
  padding: 0 var(--space-2);
}

@media (max-width: 899px) {
  .sidebar {
    height: auto;
    padding: 0 var(--space-1) env(safe-area-inset-bottom, 0px);
    border-top: var(--border-width) solid var(--color-border);
    border-right: 0;
  }

  .wordmark,
  .overview,
  .foot {
    display: none;
  }
}
</style>
