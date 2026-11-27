<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import FindingPanel from '@/components/finding/FindingPanel.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopBar from '@/components/layout/AppTopBar.vue'
import { useCheckFinishToasts } from '@/composables/useCheckFinishToasts'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { useNavigationShortcuts } from '@/composables/useNavigationShortcuts'
import { useLabelsStore } from '@/stores/labelsStore'

const route = useRoute()
const labels = useLabelsStore()
const main = ref<HTMLElement | null>(null)

useNavigationShortcuts()
useDocumentTitle()
useCheckFinishToasts()

onMounted(() => {
  void labels.ensureLoaded()
})

// top-level record, so a panel child route such as a proposal keeps focus where it is
watch(
  () => route.matched[0]?.path,
  async (view, previous) => {
    if (previous !== undefined && view !== previous) {
      await nextTick()
      main.value?.focus({ preventScroll: true })
    }
  },
)
</script>

<template>
  <div class="app-shell">
    <AppSidebar class="sidebar" data-sticky-edge="bottom" />
    <div class="column">
      <AppTopBar />
      <div class="body">
        <main ref="main" class="main" tabindex="-1">
          <slot />
        </main>
        <FindingPanel />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
}

.column {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.body {
  flex: 1;
}

.main:focus {
  outline: none;
}

@media (max-width: 899px) {
  .app-shell {
    grid-template-columns: minmax(0, 1fr);
    padding-bottom: var(--nav-inset);
  }

  .sidebar {
    position: fixed;
    inset: auto 0 0;
    z-index: var(--z-sticky);
  }
}
</style>
