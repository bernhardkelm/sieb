<script setup lang="ts">
import { isDecidableVerdict } from '#core/proposal.ts'

import CloseButton from '@/components/common/CloseButton.vue'
import CopyButton from '@/components/common/CopyButton.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import LoadState from '@/components/common/LoadState.vue'
import ConflictNotice from '@/components/proposals/ConflictNotice.vue'
import ProposalActions from '@/components/proposals/ProposalActions.vue'
import ProposalEditForm from '@/components/proposals/ProposalEditForm.vue'
import ProposalSections from '@/components/proposals/ProposalSections.vue'
import RejectDialog from '@/components/proposals/RejectDialog.vue'
import { useProposalReviewPanel } from '@/composables/useProposalReviewPanel'
import { useProposalReviewStore } from '@/stores/proposalReviewStore'

const props = defineProps<{
  proposalId: number
}>()

const emit = defineEmits<{ resolved: []; close: [] }>()

const store = useProposalReviewStore()
const { panel, actions, chordRefused, onKeydown, cancelEdit } = useProposalReviewPanel(
  () => props.proposalId,
  { resolved: () => emit('resolved'), close: () => emit('close') },
)
const { busy, editing, editError, rejecting, rejectError } = actions
</script>

<template>
  <aside
    ref="panel"
    class="proposal-review side-panel"
    tabindex="-1"
    aria-label="Proposal review"
    data-shortcut-scope="panel"
    :aria-busy="store.loading || busy"
    @keydown="onKeydown"
  >
    <header class="header">
      <h2 class="vuln-id">{{ store.detail?.proposal.vulnId ?? `Proposal ${proposalId}` }}</h2>
      <CopyButton v-if="store.detail" :value="store.detail.proposal.vulnId" label="Copy CVE ID" />
      <LoadingSpinner v-if="store.loading || busy" />
      <CloseButton label="Close review" @click="emit('close')" />
    </header>
    <template v-if="store.detail">
      <div class="body">
        <ProposalSections :detail="store.detail" />
      </div>
      <template v-if="store.detail.proposal.state === 'open'">
        <ConflictNotice
          v-if="editing && store.conflict"
          class="conflict-note"
          @acknowledge="store.acknowledge()"
        />
        <ProposalEditForm
          v-if="editing"
          :detail="store.detail"
          :error="editError"
          :submitting="busy"
          @submit="actions.acceptEdited"
          @cancel="cancelEdit"
          @dirty="actions.editDirty.value = $event"
        />
        <ProposalActions
          v-else
          :detail="store.detail"
          :busy="busy"
          :conflict="store.conflict"
          :chord-refused="chordRefused"
          @accept="actions.accept"
          @edit="actions.startEdit"
          @reject="actions.startReject"
          @acknowledge="store.acknowledge()"
        />
      </template>
      <RejectDialog
        v-model:open="rejecting"
        :vuln-id="store.detail.proposal.vulnId"
        :dismiss="!isDecidableVerdict(store.detail.proposal.verdict)"
        :busy="busy"
        :error="rejectError"
        @confirm="actions.reject"
      />
    </template>
    <LoadState
      v-else
      subject="the proposal"
      :error="store.error"
      :not-found="store.notFound ? 'This proposal does not exist.' : null"
      @retry="store.reload()"
    />
  </aside>
</template>

<style scoped src="@/components/layout/sidePanel.css"></style>

<style scoped>
.conflict-note {
  margin: 0 var(--space-4) var(--space-3);
}
</style>
