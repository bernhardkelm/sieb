<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import KeyHint from '@/components/common/KeyHint.vue'
import OverviewStats from '@/components/overview/OverviewStats.vue'
import { formatCount } from '@/format/count'
import { hintsForRoute } from '@/keyboard/keyboardHints'
import { NAV_ITEMS } from '@/router/navItems'
import { useHintActionsStore } from '@/stores/hintActionsStore'
import { useInboxStore } from '@/stores/inboxStore'
import { useMcpStore } from '@/stores/mcpStore'

const route = useRoute()
const actions = useHintActionsStore()
const mcp = useMcpStore()
const inbox = useInboxStore()

const hints = computed(() => hintsForRoute(route.name, mcp.enabled))

onMounted(() => {
  inbox.startPolling()
})

onBeforeUnmount(() => {
  inbox.stopPolling()
})
</script>

<template>
  <div class="sidebar">
    <p class="wordmark">sieb</p>
    <nav aria-label="Views">
      <ul class="nav">
        <li v-for="item in NAV_ITEMS" :key="item.name">
          <RouterLink class="link" :to="{ name: item.name }" :aria-keyshortcuts="item.shortcut">
            <span class="label">{{ item.label }}</span>
            <span v-if="item.badge === 'inbox' && inbox.counts.total > 0" class="badge">
              {{ formatCount(inbox.counts.total) }}<span class="visually-hidden">&nbsp;open</span>
            </span>
            <KeyHint class="shortcut" :keys="[item.shortcut]" />
          </RouterLink>
        </li>
      </ul>
    </nav>
    <OverviewStats class="overview" />
    <ul class="hints" aria-label="Keyboard shortcuts">
      <li v-for="hint in hints" :key="hint.label">
        <button
          v-if="hint.action"
          type="button"
          class="hint action"
          :aria-disabled="actions.reasonOf(hint.action) !== null || undefined"
          :title="actions.reasonOf(hint.action) ?? undefined"
          @click="actions.run(hint.action)"
        >
          <KeyHint :keys="hint.keys" />
          <span>{{ hint.label }}</span>
        </button>
        <span v-else class="hint">
          <KeyHint :keys="hint.keys" />
          <span>{{ hint.label }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100vh;
  overflow-y: auto;
  padding: var(--space-3) var(--space-2);
  border-right: var(--border-width) solid var(--color-border);
  background: var(--color-sidebar);
}

.wordmark {
  padding: 0 var(--space-2);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  line-height: var(--control-height);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--control-height);
  padding: 0 var(--space-2);
  border-radius: var(--radius);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

.label {
  margin-right: auto;
}

.badge {
  min-width: calc(var(--space-base) * 5);
  margin-right: var(--space-2);
  padding: 0 var(--space-1-5);
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  line-height: calc(var(--space-base) * 4.5);
  text-align: center;
}

.link:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.link.router-link-active {
  background: var(--color-selected);
  color: var(--color-text);
}

.hints {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
  margin: auto 0 0;
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
  .hints,
  .shortcut {
    display: none;
  }

  .nav {
    flex-direction: row;
    gap: var(--space-1);
  }

  .nav li {
    flex: 1;
    min-width: 0;
  }

  .label {
    margin-right: 0;
  }

  .badge {
    margin: 0 0 0 var(--space-1);
  }

  .link {
    justify-content: center;
    height: var(--bottom-nav-height);
    border-radius: 0;
    box-shadow: inset 0 var(--border-width-strong) 0 transparent;
    font-size: var(--font-size-sm);
    text-align: center;
  }

  .link.router-link-active {
    background: transparent;
    box-shadow: inset 0 var(--border-width-strong) 0 var(--color-accent);
    color: var(--color-accent);
  }
}
</style>
