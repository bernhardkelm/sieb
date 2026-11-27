<script setup lang="ts">
import { computed, provide, ref, useId } from 'vue'

import { currentInstances } from '#core/instance.ts'
import { packageOrigins } from '#core/packageOrigin.ts'
import AutoCheckButton from '@/components/checks/AutoCheckButton.vue'
import FindingCheckLine from '@/components/checks/FindingCheckLine.vue'
import CloseButton from '@/components/common/CloseButton.vue'
import CopyButton from '@/components/common/CopyButton.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import LoadState from '@/components/common/LoadState.vue'
import SectionHeading from '@/components/common/SectionHeading.vue'
import DecisionHistory from '@/components/decision/DecisionHistory.vue'
import { STICKY_ACTIONS_TARGET } from '@/components/decision/stickyActionsTarget'
import FindingDecisions from '@/components/finding/FindingDecisions.vue'
import FindingHeader from '@/components/finding/FindingHeader.vue'
import FoundIn from '@/components/finding/FoundIn.vue'
import HandoffButton from '@/components/finding/HandoffButton.vue'
import InstanceTable from '@/components/finding/InstanceTable.vue'
import KevDetails from '@/components/finding/KevDetails.vue'
import FindingInboxLine from '@/components/inbox/FindingInboxLine.vue'
import { useAutoCheckHintActions } from '@/composables/useAutoCheckHintActions'
import { useFindingPanel } from '@/composables/useFindingPanel'
import { useHandoff } from '@/composables/useHandoff'
import { useHandoffHintActions } from '@/composables/useHandoffHintActions'
import { usePanelDismiss } from '@/composables/usePanelDismiss'
import { usePanelFocus } from '@/composables/usePanelFocus'
import { usePanelSeen } from '@/composables/usePanelSeen'
import { usePanelShortcuts } from '@/composables/usePanelShortcuts'
import { useWindowKeydown } from '@/composables/useWindowKeydown'
import { useFindingDetailStore } from '@/stores/findingDetailStore'
import { useMcpStore } from '@/stores/mcpStore'

const { findingId, closeFinding } = useFindingPanel()
const store = useFindingDetailStore()
const mcp = useMcpStore()
const markShown = usePanelSeen()
const { prompts: handoffPrompts, command: handoffCommand } = useHandoff()

useHandoffHintActions()
useAutoCheckHintActions()

const decisionActionsId = useId()

provide(STICKY_ACTIONS_TARGET, `#${decisionActionsId}`)

const panel = ref<HTMLElement | null>(null)
const origins = computed(() =>
  store.detail
    ? packageOrigins(currentInstances(store.detail.instances, store.detail.finding.resolvedAt))
    : [],
)
const focusPanel = usePanelFocus(findingId, panel)

/**
 * Marks the shown finding seen after a saved decision and focuses the panel again.
 * @returns {void}
 */
const onSaved = (): void => {
  markShown()
  focusPanel()
}

const { onPanelKeydown, onWindowKeydown } = usePanelShortcuts(focusPanel)

usePanelDismiss(panel, () => {
  void closeFinding()
})

useWindowKeydown(onWindowKeydown)
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
        v-if="mcp.enabled && handoffPrompts !== null"
        :prompts="handoffPrompts"
        :command="handoffCommand"
      />
      <AutoCheckButton v-if="store.detail" />
      <LoadingSpinner v-if="store.loading" />
      <CloseButton label="Close panel" @click="closeFinding" />
    </header>
    <div v-if="store.detail" class="body">
      <FindingHeader
        :finding="store.detail.finding"
        :source-access="mcp.enabled ? store.detail.sourceAccess : null"
      />
      <FindingInboxLine :finding="store.detail.finding" />
      <FindingCheckLine :finding-id="store.detail.finding.id" />
      <section v-if="store.detail.kev" class="section" aria-labelledby="panel-kev">
        <SectionHeading id="panel-kev">Known exploited</SectionHeading>
        <KevDetails :details="store.detail.kev" />
      </section>
      <section class="section" aria-labelledby="panel-decision">
        <SectionHeading id="panel-decision">Decision</SectionHeading>
        <FindingDecisions :detail="store.detail" @saved="onSaved" />
      </section>
      <div :id="decisionActionsId" class="decision-actions" />
      <section v-if="origins.length > 0" class="section" aria-labelledby="panel-found-in">
        <SectionHeading id="panel-found-in">Found in</SectionHeading>
        <FoundIn :origins="origins" />
      </section>
      <section class="section" aria-labelledby="panel-instances">
        <SectionHeading id="panel-instances" :count="store.detail.instances.length">
          Instances
        </SectionHeading>
        <InstanceTable :instances="store.detail.instances" />
      </section>
      <section class="section" aria-labelledby="panel-history">
        <SectionHeading id="panel-history">History</SectionHeading>
        <DecisionHistory :events="store.detail.events" :decisions="store.detail.decisions" />
      </section>
    </div>
    <LoadState
      v-else
      subject="the finding"
      :error="store.error"
      :not-found="store.notFound ? 'This finding does not exist.' : null"
      @retry="store.reload()"
    />
  </aside>
</template>

<style scoped src="@/components/layout/sidePanel.css"></style>
<style scoped src="@/components/layout/panelSection.css"></style>
