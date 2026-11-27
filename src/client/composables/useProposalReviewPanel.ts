import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

import { useChordArming } from '@/composables/useChordArming'
import { usePanelDismiss } from '@/composables/usePanelDismiss'
import {
  useProposalReviewActions,
  type ProposalReviewActions,
} from '@/composables/useProposalReviewActions'
import { useProposalReviewKeys } from '@/composables/useProposalReviewKeys'
import { useProposalReviewStore } from '@/stores/proposalReviewStore'

export interface ProposalReviewPanelEvents {
  resolved: () => void
  close: () => void
}

export interface ProposalReviewPanel {
  /** Panel element, bound with ref="panel" */
  panel: Ref<HTMLElement | null>
  actions: ProposalReviewActions
  /** Whether the last accept chord was refused, the panel then shows how to arm it */
  chordRefused: Ref<boolean>
  onKeydown: (event: KeyboardEvent) => void
  /** Closes the decision form and returns focus to the panel */
  cancelEdit: () => void
}

/**
 * Drives the review panel of a proposal: loads the proposal whenever the id changes and focuses
 * the panel, clears the review store on unmount, arms the accept chord once the detail showed,
 * closes on a press outside unless a command runs or the form holds a draft, and wires the keys.
 * @param {() => number} proposalId - Reviewed proposal id
 * @param {ProposalReviewPanelEvents} events - Called when the proposal resolved or the panel closes
 * @returns {ProposalReviewPanel} - Panel ref, actions and key handling
 */
export const useProposalReviewPanel = (
  proposalId: () => number,
  events: ProposalReviewPanelEvents,
): ProposalReviewPanel => {
  const store = useProposalReviewStore()
  const actions = useProposalReviewActions((outcome) => {
    if (outcome === 'resolved') {
      events.resolved()
    } else {
      events.close()
    }
  })
  const panel = ref<HTMLElement | null>(null)
  const readyId = computed(() => (store.detail?.proposal.id === proposalId() ? proposalId() : null))
  const acceptArmed = useChordArming(readyId, panel)

  usePanelDismiss(
    panel,
    () => events.close(),
    () => !actions.busy.value && !(actions.editing.value && actions.editDirty.value),
  )

  /**
   * Focuses the panel itself.
   * @returns {void}
   */
  const focusPanel = (): void => {
    panel.value?.focus({ preventScroll: true })
  }

  /**
   * Closes the decision form and returns focus to the panel.
   * @returns {void}
   */
  const cancelEdit = (): void => {
    actions.cancelEdit()
    focusPanel()
  }

  const { chordRefused, onKeydown } = useProposalReviewKeys({
    actions,
    readyId,
    acceptArmed,
    focusPanel,
    cancelEdit,
    close: () => events.close(),
  })

  watch(
    proposalId,
    async (id) => {
      actions.cancelEdit()
      actions.rejecting.value = false
      void store.load(id)
      await nextTick()
      focusPanel()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    store.clear()
  })

  return { panel, actions, chordRefused, onKeydown, cancelEdit }
}
