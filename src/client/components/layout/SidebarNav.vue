<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import KeyHint from '@/components/common/KeyHint.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { NAV_ICONS } from '@/components/layout/navIcons'
import { useFeatures } from '@/composables/useFeatures'
import { formatCount } from '@/format/count'
import { navItemsFor, type NavItem } from '@/router/navItems'
import { useChecksStore } from '@/stores/checksStore'
import { useInboxStore } from '@/stores/inboxStore'

const inbox = useInboxStore()
const checks = useChecksStore()

const features = useFeatures()

const navItems = computed(() => navItemsFor(features.value))

/**
 * Returns the count a nav item shows next to its label.
 * @param {NavItem} item - Nav item
 * @returns {number} - Open Inbox items or open checks, 0 hides the badge
 */
const badgeOf = (item: NavItem): number => {
  if (item.badge === 'inbox') {
    return inbox.counts.total
  }

  return item.badge === 'checks' ? checks.open.length : 0
}
</script>

<template>
  <nav aria-label="Views">
    <ul class="nav">
      <li v-for="item in navItems" :key="item.name">
        <RouterLink class="link" :to="{ name: item.name }" :aria-keyshortcuts="item.shortcut">
          <span class="label" :class="{ replaced: item.shortLabel }">{{ item.label }}</span>
          <span v-if="item.shortLabel" class="short-label" aria-hidden="true">
            {{ item.shortLabel }}
          </span>
          <span class="glyph">
            <AppIcon class="icon" :name="NAV_ICONS[item.icon]" />
            <span v-if="badgeOf(item) > 0" class="badge">
              {{ formatCount(badgeOf(item)) }}<span class="visually-hidden">&nbsp;open</span>
            </span>
          </span>
          <KeyHint class="shortcut" decorative :keys="[item.shortcut]" />
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
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

/* the badge follows the label on the sidebar and sits on the icon in the bottom navigation */
.glyph {
  display: contents;
}

.icon,
.short-label {
  display: none;
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
</style>

<style scoped src="@/components/layout/sidebarBottomNav.css"></style>
