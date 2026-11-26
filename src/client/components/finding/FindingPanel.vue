<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import CloseButton from '@/components/common/CloseButton.vue'
import CopyButton from '@/components/common/CopyButton.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DecisionHistory from '@/components/decision/DecisionHistory.vue'
import FindingDecisions from '@/components/finding/FindingDecisions.vue'
import FindingHeader from '@/components/finding/FindingHeader.vue'
import HandoffButton from '@/components/finding/HandoffButton.vue'
import InstanceTable from '@/components/finding/InstanceTable.vue'
import KevDetails from '@/components/finding/KevDetails.vue'
import FindingInboxLine from '@/components/inbox/FindingInboxLine.vue'
import { useFindingPanel } from '@/composables/useFindingPanel'
import { useHandoff } from '@/composables/useHandoff'
import { useHandoffHintActions } from '@/composables/useHandoffHintActions'
import { usePanelDismiss } from '@/composables/usePanelDismiss'
import { usePanelShortcuts } from '@/composables/usePanelShortcuts'
import { useFindingDetailStore } from '@/stores/findingDetailStore'
import { useMcpStore } from '@/stores/mcpStore'

const { findingId, closeFinding } = useFindingPanel()
const store = useFindingDetailStore()
const mcp = useMcpStore()
const { prompt: handoffPrompt, command: handoffCommand } = useHandoff()

useHandoffHintActions()

const panel = ref<HTMLElement | null>(null)
let opener: Element | null = null

/**
 * Moves focus back to the row of a finding, or to the element focused before the panel opened,
 * once focus left with the panel. Focus a press outside the panel put elsewhere stays there.
 * @param {string} id - Finding id of the closed panel
 * @returns {void}
 */
const restoreFocus = (id: string): void => {
  if (document.activeElement !== null && document.activeElement !== document.body) {
    opener = null
    return
  }

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

usePanelDismiss(panel, () => {
  void closeFinding()
})

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
    class="finding-panel side-panel"
    tabindex="-1"
    aria-label="Finding details"
    data-shortcut-scope="panel"
    :aria-busy="store.loading"
    @keydown="onPanelKeydown"
  >
    <header class="header">
      <h2 class="vuln-id">{{ store.detail?.finding.vulnId ?? `Finding ${findingId}` }}</h2>
      <CopyButton v-if="store.detail" :value="store.detail.finding.vulnId" label="Copy CVE ID" />
      <HandoffButton
        v-if="mcp.enabled && handoffPrompt !== null"
        :prompt="handoffPrompt"
        :command="handoffCommand"
      />
      <LoadingSpinner v-if="store.loading" />
      <CloseButton label="Close panel" @click="closeFinding" />
    </header>
    <div v-if="store.detail" class="body">
      <FindingHeader
        :finding="store.detail.finding"
        :source-access="mcp.enabled ? store.detail.sourceAccess : null"
      />
      <FindingInboxLine :finding="store.detail.finding" />
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

<style scoped src="@/components/layout/sidePanel.css"></style>
