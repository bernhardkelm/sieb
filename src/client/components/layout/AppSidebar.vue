<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import KeyHint from '@/components/common/KeyHint.vue'
import SidebarNav from '@/components/layout/SidebarNav.vue'
import SourceCodeLink from '@/components/layout/SourceCodeLink.vue'
import OverviewStats from '@/components/overview/OverviewStats.vue'
import { hintView } from '@/keyboard/hintView'
import { hintsForRoute } from '@/keyboard/keyboardHints'
import { HOME_ROUTE } from '@/router/routeNames'
import { useChecksStore } from '@/stores/checksStore'
import { useHintActionsStore } from '@/stores/hintActionsStore'
import { useInboxStore } from '@/stores/inboxStore'
import { useMcpStore } from '@/stores/mcpStore'

const route = useRoute()
const actions = useHintActionsStore()
const mcp = useMcpStore()
const inbox = useInboxStore()
const checks = useChecksStore()

const hints = computed(() =>
  hintsForRoute(route.name, mcp.enabled, checks.enabled).map((hint) =>
    hint.action
      ? hintView(hint, actions.reasonOf(hint.action), actions.bulkOf(hint.action))
      : hintView(hint, null, null),
  ),
)

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
      <ul class="hints" aria-label="Keyboard shortcuts">
        <li v-for="view in hints" :key="view.hint.label">
          <button
            v-if="view.hint.action"
            type="button"
            class="hint action"
            :aria-disabled="view.blockedBy !== null || undefined"
            :tabindex="view.blockedBy !== null ? -1 : undefined"
            :title="view.title"
            @click="actions.run(view.hint.action)"
          >
            <KeyHint :keys="view.hint.keys" />
            <span v-if="view.ariaLabel" class="visually-hidden">{{ view.ariaLabel }}</span>
            <span :aria-hidden="view.ariaLabel ? 'true' : undefined">{{ view.text }}</span>
          </button>
          <span v-else class="hint">
            <KeyHint :keys="view.hint.keys" />
            <span>{{ view.text }}</span>
          </span>
        </li>
      </ul>
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

.hints {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
  margin: 0;
  padding: 0;
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
  list-style: none;
}

.hint {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-0-5) var(--space-2);
  border-radius: var(--radius);
}

.action {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
  text-align: left;
  transition:
    background-color var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

.action:hover:not([aria-disabled='true']) {
  background: var(--color-hover);
  color: var(--color-text);
}

.source-code {
  padding: 0 var(--space-2);
}

.action[aria-disabled='true'] {
  cursor: default;
  opacity: 0.55;
}

@media (hover: none) and (pointer: coarse) {
  .hints {
    display: none;
  }
}

/* very short viewport: hints go after the secondary overview panels (OverviewStats) */
@media (max-height: 619px) {
  .hints {
    display: none;
  }
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
