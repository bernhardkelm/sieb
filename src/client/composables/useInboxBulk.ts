import { computed, ref, type ComputedRef, type Ref } from 'vue'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { bulkAcceptProposals, bulkRejectProposals } from '@/api/proposalBulkApi'
import {
  acceptBlockedBy,
  bulkTargetsOf,
  rejectBlockedBy,
  type InboxBulkTargets,
} from '@/components/inbox/inboxBulkTargets'
import { inboxBulkCounts, type InboxBulkCounts } from '@/components/inbox/inboxBulkCounts'
import { acceptItems } from '@/components/inbox/inboxBulkResults'
import type { ListSelection } from '@/composables/useListSelection'
import { useInboxBulkFinish } from '@/composables/useInboxBulkFinish'
import { runUnlessBlocked } from '@/toast/blockedNotice'
import { notifyError } from '@/toast/toastManager'
import { notifyUnlessValidation } from '@/toast/validationNotice'

export interface InboxBulk {
  targets: ComputedRef<InboxBulkTargets>
  /** Checked items each bulk action acts on, for the counts on the buttons */
  counts: ComputedRef<InboxBulkCounts>
  acceptBlockedBy: ComputedRef<string | null>
  rejectBlockedBy: ComputedRef<string | null>
  acceptOpen: Ref<boolean>
  rejectOpen: Ref<boolean>
  busy: Ref<boolean>
  /** Failure of the last reject, its validation errors show in the dialog */
  rejectError: Ref<unknown>
  /** Opens the accept confirmation, or names why it cannot run */
  openAccept: () => void
  /** Opens the reject dialog, or names why it cannot run */
  openReject: () => void
  accept: () => Promise<void>
  reject: (reason: string) => Promise<void>
}

/** Open state of the two dialogs, created before the list cursor so it can pause the keys */
export interface InboxBulkDialogs {
  acceptOpen: Ref<boolean>
  rejectOpen: Ref<boolean>
}

const BLOCKED_TITLE = 'Not available'

/**
 * Drives the bulk accept and reject of the checked proposals in the Inbox. Accept takes every
 * checked proposal unchanged after a confirmation, the server skips outdated and inconclusive
 * ones; reject sends one reason for all. Afterwards one toast sums up the outcome, the handled
 * rows are unchecked, skipped ones stay checked, and the Inbox is refetched.
 * @param {ListSelection<string>} selection - Cursor and checked rows of the list
 * @param {Readonly<Ref<ReadonlyMap<string, InboxItem>>>} byKey - Listed items by key
 * @param {() => Promise<void>} settle - Refetches the Inbox and focuses the cursor row
 * @param {InboxBulkDialogs} dialogs - Open state of the accept and reject dialogs
 * @returns {InboxBulk} - Targets, dialog state and the actions
 */
export const useInboxBulk = (
  selection: ListSelection<string>,
  byKey: Readonly<Ref<ReadonlyMap<string, InboxItem>>>,
  settle: () => Promise<void>,
  { acceptOpen, rejectOpen }: InboxBulkDialogs,
): InboxBulk => {
  const finish = useInboxBulkFinish(selection, settle)
  const targets = computed(() => bulkTargetsOf(selection.checkedInOrder.value, byKey.value))
  const acceptBlocked = computed(() => acceptBlockedBy(targets.value))
  const rejectBlocked = computed(() => rejectBlockedBy(targets.value))
  const busy = ref(false)
  const rejectError = ref<unknown>(null)

  /**
   * Accepts the checked proposals unchanged with the decisions the Inbox showed for them.
   * @returns {Promise<void>} - Resolves once settled
   */
  const accept = async (): Promise<void> => {
    const items = acceptItems(targets.value.proposals)

    busy.value = true

    try {
      const results = await bulkAcceptProposals(items)

      acceptOpen.value = false
      await finish('Accepted', results)
    } catch (error) {
      acceptOpen.value = false
      notifyError('Proposals not accepted', error)
      await settle()
    } finally {
      busy.value = false
    }
  }

  /**
   * Rejects the checked proposals with one reason, a validation error keeps the dialog open.
   * @param {string} reason - Why the proposals are wrong
   * @returns {Promise<void>} - Resolves once settled
   */
  const reject = async (reason: string): Promise<void> => {
    const ids = targets.value.proposals.map((item) => item.refs.proposalId)

    busy.value = true
    rejectError.value = null

    try {
      const results = await bulkRejectProposals(ids, reason.trim())

      rejectOpen.value = false
      await finish('Rejected', results)
    } catch (error) {
      rejectError.value = error

      notifyUnlessValidation('Proposals not rejected', error)
    } finally {
      busy.value = false
    }
  }

  /**
   * Opens the accept confirmation, or names why it cannot run.
   * @returns {void}
   */
  const openAccept = (): void => {
    runUnlessBlocked(acceptBlocked.value, BLOCKED_TITLE, () => {
      acceptOpen.value = true
    })
  }

  /**
   * Opens the reject dialog, or names why it cannot run.
   * @returns {void}
   */
  const openReject = (): void => {
    runUnlessBlocked(rejectBlocked.value, BLOCKED_TITLE, () => {
      rejectError.value = null
      rejectOpen.value = true
    })
  }

  return {
    targets,
    counts: computed(() => inboxBulkCounts(targets.value)),
    acceptBlockedBy: acceptBlocked,
    rejectBlockedBy: rejectBlocked,
    acceptOpen,
    rejectOpen,
    busy,
    rejectError,
    openAccept,
    openReject,
    accept,
    reject,
  }
}
