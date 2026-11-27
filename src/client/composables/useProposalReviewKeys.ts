import { ref, watch, type Ref } from 'vue'

import { isDecidableVerdict } from '#core/proposal.ts'

import type { ProposalReviewActions } from '@/composables/useProposalReviewActions'
import { isEditableTarget } from '@/keyboard/keyboardTarget'
import { useProposalReviewStore } from '@/stores/proposalReviewStore'

export interface ProposalReviewKeyOptions {
  actions: ProposalReviewActions
  /** Proposal whose detail is shown, null while it loads */
  readyId: Readonly<Ref<number | null>>
  /** Whether the accept chord is armed for the shown proposal */
  acceptArmed: () => boolean
  focusPanel: () => void
  cancelEdit: () => void
  close: () => void
}

export interface ProposalReviewKeys {
  /** Whether the last accept chord was refused, the panel then shows how to arm it */
  chordRefused: Ref<boolean>
  onKeydown: (event: KeyboardEvent) => void
}

/**
 * Handles keys inside the review panel: Cmd+Enter or Ctrl+Enter accepts while no form is open,
 * once armed for this proposal and never on a key repeat or an inconclusive proposal, a refused press shows how to arm it;
 * Escape leaves a text entry, cancels an untouched edit, or closes the panel. No single key
 * accepts.
 * @param {ProposalReviewKeyOptions} options - Review actions, arming and the panel hooks
 * @returns {ProposalReviewKeys} - Refused chord state and the key handler
 */
export const useProposalReviewKeys = (options: ProposalReviewKeyOptions): ProposalReviewKeys => {
  const { actions } = options
  const store = useProposalReviewStore()
  const chordRefused = ref(false)

  watch(options.readyId, () => {
    chordRefused.value = false
  })

  /**
   * Handles a key press inside the panel.
   * @param {KeyboardEvent} event - Keydown event
   * @returns {void}
   */
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) {
      return
    }

    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      const proposal = store.detail?.proposal

      if (
        !actions.editing.value &&
        proposal?.state === 'open' &&
        isDecidableVerdict(proposal.verdict)
      ) {
        event.preventDefault()

        if (event.repeat) {
          return
        }

        if (options.acceptArmed()) {
          void actions.accept()
        } else {
          chordRefused.value = true
        }
      }

      return
    }

    if (event.key !== 'Escape') {
      return
    }

    event.preventDefault()

    if (isEditableTarget(event.target)) {
      options.focusPanel()
    } else if (actions.editing.value) {
      if (!actions.editDirty.value) {
        options.cancelEdit()
      }
    } else {
      options.close()
    }
  }

  return { chordRefused, onKeydown }
}
