<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import CloseButton from '@/components/common/CloseButton.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DecisionHistory from '@/components/decision/DecisionHistory.vue'
import FindingDecisions from '@/components/finding/FindingDecisions.vue'
import FindingHeader from '@/components/finding/FindingHeader.vue'
import InstanceTable from '@/components/finding/InstanceTable.vue'
import KevDetails from '@/components/finding/KevDetails.vue'
import { useFindingPanel } from '@/composables/useFindingPanel'
import { usePanelShortcuts } from '@/composables/usePanelShortcuts'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

const { findingId, closeFinding } = useFindingPanel()
const store = useFindingDetailStore()

const panel = ref<HTMLElement | null>(null)
let opener: Element | null = null

/**
 * Moves focus back to the row of a finding, or to the element focused before the panel opened.
 * @param {string} id - Finding id of the closed panel
 * @returns {void}
 */
const restoreFocus = (id: string): void => {
  const row = document.querySelector<HTMLElement>(`[data-finding-id="${CSS.escape(id)}"]`)
  const target = row ?? (opener instanceof HTMLElement && opener.isConnected ? opener : null)

  target?.focus({ preventScroll: false })
  opener = null
}

/**
 * Focuses the panel itself.
 * @returns {void}
 */
const focusPanel = (): void => {
  panel.value?.focus({ preventScroll: true })
}

const { onPanelKeydown, onWindowKeydown } = usePanelShortcuts(focusPanel)

watch(
  findingId,
  async (id, previous) => {
    if (id === null) {
      store.clear()

      if (previous) {
        await nextTick()
        restoreFocus(previous)
      }

      return
    }

    void store.load(Number(id))

    if (!previous) {
      opener = document.activeElement
      await nextTick()
      focusPanel()
    }
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

<template>
  <aside
    v-if="findingId !== null"
    ref="panel"
    class="finding-panel"
    tabindex="-1"
    aria-label="Finding details"
    data-shortcut-scope="panel"
    :aria-busy="store.loading"
    @keydown="onPanelKeydown"
  >
    <header class="header">
      <h2 class="vuln-id">{{ store.detail?.finding.vulnId ?? `Finding ${findingId}` }}</h2>
      <LoadingSpinner v-if="store.loading" />
      <CloseButton label="Close panel" @click="closeFinding" />
    </header>
    <div v-if="store.detail" class="body">
      <FindingHeader :finding="store.detail.finding" />
      <section v-if="store.detail.kev" class="section" aria-labelledby="panel-kev">
        <h3 id="panel-kev" class="section-title">Known exploited</h3>
        <KevDetails :details="store.detail.kev" />
      </section>
      <section class="section" aria-labelledby="panel-decision">
        <h3 id="panel-decision" class="section-title">Decision</h3>
        <FindingDecisions :detail="store.detail" @saved="focusPanel" />
      </section>
      <section class="section" aria-labelledby="panel-instances">
        <h3 id="panel-instances" class="section-title">
          Instances <span class="count">{{ store.detail.instances.length }}</span>
        </h3>
        <InstanceTable :instances="store.detail.instances" />
      </section>
      <section class="section" aria-labelledby="panel-history">
        <h3 id="panel-history" class="section-title">History</h3>
        <DecisionHistory :events="store.detail.events" :decisions="store.detail.decisions" />
      </section>
    </div>
    <div v-else-if="store.error" class="state" role="alert">
      <p>{{ store.notFound ? 'This finding does not exist.' : 'Could not load the finding.' }}</p>
      <BaseButton v-if="!store.notFound" @click="store.reload()">Retry</BaseButton>
    </div>
    <p v-else class="state">Loading…</p>
  </aside>
</template>

<style scoped>
/* overlays the list on every width, so the list keeps its columns while the panel is open */
.finding-panel {
  position: fixed;
  top: var(--topbar-height);
  right: 0;
  z-index: var(--z-panel);
  width: var(--panel-width);
  max-width: 100%;
  height: calc(100vh - var(--topbar-height) - var(--nav-inset));
  overflow-y: auto;
  overscroll-behavior: contain;
  border-left: var(--border-width) solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-panel);
  animation: panel-in var(--duration-medium) var(--ease);
}

@keyframes panel-in {
  from {
    transform: translateX(var(--space-8));
    opacity: 0;
  }
}

.finding-panel:focus-visible {
  outline: none;
  border-left-color: var(--color-focus);
  box-shadow:
    inset var(--border-width) 0 0 var(--color-focus),
    var(--shadow-panel);
}

@media (max-width: 639px) {
  .finding-panel {
    inset: 0;
    width: 100%;
    height: 100dvh;
    border-left: 0;
    box-shadow: none;
  }

  .finding-panel:focus-visible {
    box-shadow: inset 0 0 0 var(--border-width-strong) var(--color-focus);
  }

  .header {
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
  }

  .vuln-id {
    font-size: var(--font-size-lg);
  }
}

.header {
  position: sticky;
  top: 0;
  z-index: var(--z-raised);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--border-width) solid var(--color-border);
  background: var(--color-surface);
}

.vuln-id {
  flex: 1;
  font-family: var(--font-mono);
  font-size: var(--font-size-md);
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-title {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
}

.count {
  color: var(--color-text-subtle);
  font-weight: var(--font-weight-regular);
}

.state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-4);
  color: var(--color-text-muted);
}
</style>
