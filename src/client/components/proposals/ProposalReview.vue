<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import CloseButton from '@/components/common/CloseButton.vue'
import CopyButton from '@/components/common/CopyButton.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ConflictNotice from '@/components/proposals/ConflictNotice.vue'
import ProposalActions from '@/components/proposals/ProposalActions.vue'
import ProposalEditForm from '@/components/proposals/ProposalEditForm.vue'
import ProposalSections from '@/components/proposals/ProposalSections.vue'
import RejectDialog from '@/components/proposals/RejectDialog.vue'
import { useChordArming } from '@/composables/useChordArming'
import { usePanelDismiss } from '@/composables/usePanelDismiss'
import { useProposalReviewActions } from '@/composables/useProposalReviewActions'
import { useProposalReviewKeys } from '@/composables/useProposalReviewKeys'
import { useProposalReviewStore } from '@/stores/proposalReviewStore'

const props = defineProps<{
  proposalId: number
}>()

const emit = defineEmits<{ resolved: []; close: [] }>()

const store = useProposalReviewStore()
const actions = useProposalReviewActions((outcome) => {
  if (outcome === 'resolved') {
    emit('resolved')
  } else {
    emit('close')
  }
})
const { busy, editing, editError, rejecting, rejectError } = actions
const panel = ref<HTMLElement | null>(null)
const readyId = computed(() =>
  store.detail?.proposal.id === props.proposalId ? props.proposalId : null,
)
const acceptArmed = useChordArming(readyId, panel)

usePanelDismiss(
  panel,
  () => emit('close'),
  () => !busy.value && !(editing.value && actions.editDirty.value),
)

/**
 * Focuses the panel itself.
 * @returns {void}
 */
const focusPanel = (): void => {
  panel.value?.focus({ preventScroll: true })
}

/**
 * Opens the reject dialog with a fresh error state.
 * @returns {void}
 */
const openReject = (): void => {
  rejectError.value = null
  rejecting.value = true
}

/**
 * Closes the decision form and returns focus to the panel.
 * @returns {void}
 */
const onCancelEdit = (): void => {
  actions.cancelEdit()
  focusPanel()
}

const { chordRefused, onKeydown } = useProposalReviewKeys({
  actions,
  readyId,
  acceptArmed,
  focusPanel,
  cancelEdit: onCancelEdit,
  close: () => emit('close'),
})

watch(
  () => props.proposalId,
  async (id) => {
    actions.cancelEdit()
    rejecting.value = false
    void store.load(id)
    await nextTick()
    focusPanel()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  store.clear()
})
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
          @cancel="onCancelEdit"
          @dirty="actions.editDirty.value = $event"
        />
        <ProposalActions
          v-else
          :busy="busy"
          :conflict="store.conflict"
          :chord-refused="chordRefused"
          @accept="actions.accept"
          @edit="actions.startEdit"
          @reject="openReject"
          @acknowledge="store.acknowledge()"
        />
      </template>
      <RejectDialog
        v-model:open="rejecting"
        :vuln-id="store.detail.proposal.vulnId"
        :busy="busy"
        :error="rejectError"
        @confirm="actions.reject"
      />
    </template>
    <div v-else-if="store.error" class="state" role="alert">
      <p>{{ store.notFound ? 'This proposal does not exist.' : 'Could not load the proposal.' }}</p>
      <BaseButton v-if="!store.notFound" @click="store.reload()">Retry</BaseButton>
    </div>
    <p v-else class="state">Loading…</p>
  </aside>
</template>

<style scoped src="@/components/layout/sidePanel.css"></style>

<style scoped>
.conflict-note {
  margin: 0 var(--space-4) var(--space-3);
}
</style>
