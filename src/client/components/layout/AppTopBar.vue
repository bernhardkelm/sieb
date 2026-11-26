<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import SyncControl from '@/components/layout/SyncControl.vue'
import OverviewSheet from '@/components/overview/OverviewSheet.vue'
import ThemeToggle from '@/components/layout/ThemeToggle.vue'
import UserMenu from '@/components/layout/UserMenu.vue'
import { useSyncShortcut } from '@/composables/useSyncShortcut'
import { useMcpStore } from '@/stores/mcpStore'
import { useMeStore } from '@/stores/meStore'
import { useSyncStore } from '@/stores/syncStore'

const route = useRoute()
const sync = useSyncStore()
const me = useMeStore()
const mcp = useMcpStore()

const title = computed(() => route.meta.title ?? 'sieb')

useSyncShortcut()

onMounted(() => {
  void sync.startPolling()
  void me.load()
  void mcp.load()
})

onBeforeUnmount(() => {
  sync.stopPolling()
})
</script>

<template>
  <header class="top-bar" data-sticky-edge="top">
    <h1 class="title">{{ title }}</h1>
    <div class="tools">
      <SyncControl
        :last-sync-at="sync.lastSyncAt"
        :ok="sync.ok"
        :syncing="sync.running"
        :error="sync.lastError"
        :fetch-error="sync.fetchError"
        :kev-feed="sync.kevFeed"
        @sync="sync.sync()"
      />
      <span v-if="me.source" class="source" title="Source the server reads findings from">
        {{ me.source }}
      </span>
      <UserMenu />
      <OverviewSheet />
      <ThemeToggle />
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  height: var(--topbar-height);
  padding: 0 var(--space-4);
  border-bottom: var(--border-width) solid var(--color-border);
  background: var(--color-surface);
}

.title {
  min-width: 0;
  font-size: var(--font-size-lg);
}

.tools {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.source {
  padding: 0 var(--space-1-5);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
}

@media (max-width: 639px) {
  .top-bar {
    gap: var(--space-2);
    padding: 0 var(--space-3);
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tools {
    flex: none;
    gap: var(--space-2);
  }

  .source {
    display: none;
  }
}
</style>
