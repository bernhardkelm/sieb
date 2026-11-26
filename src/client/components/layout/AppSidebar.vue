<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import KeyHint from '@/components/common/KeyHint.vue'
import OverviewStats from '@/components/overview/OverviewStats.vue'
import { hintsForRoute } from '@/keyboard/keyboardHints'
import { NAV_ITEMS } from '@/router/navItems'

const route = useRoute()

const hints = computed(() => hintsForRoute(route.name))
</script>

<template>
  <div class="sidebar">
    <p class="wordmark">sieb</p>
    <nav aria-label="Views">
      <ul class="nav">
        <li v-for="item in NAV_ITEMS" :key="item.name">
          <RouterLink class="link" :to="{ name: item.name }" :aria-keyshortcuts="item.shortcut">
            <span>{{ item.label }}</span>
            <KeyHint class="shortcut" :keys="[item.shortcut]" />
          </RouterLink>
        </li>
      </ul>
    </nav>
    <OverviewStats class="overview" />
    <dl class="hints" aria-label="Keyboard shortcuts">
      <div v-for="hint in hints" :key="hint.label" class="hint">
        <dt><KeyHint :keys="hint.keys" /></dt>
        <dd>{{ hint.label }}</dd>
      </div>
    </dl>
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
  gap: var(--space-1);
  margin: auto 0 0;
  padding: 0 var(--space-2);
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}

.hint {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.hint dd {
  margin: 0;
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
