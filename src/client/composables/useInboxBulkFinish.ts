import type { BulkProposalResult } from '#core/proposalBulk.ts'
import { withoutKeys } from '@/components/inbox/checkedKeys'
import { handledKeys } from '@/components/inbox/inboxBulkResults'
import type { ListSelection } from '@/composables/useListSelection'
import { bulkResultText } from '@/format/bulkProposalText'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { notifyNotice, notifySuccess } from '@/toast/toastManager'

/**
 * Finishes a bulk accept or reject of the Inbox: one toast sums up the outcome, the handled rows
 * are unchecked while skipped ones stay checked, a write bumps the data version, and the Inbox
 * is refetched.
 * @param {ListSelection<string>} selection - Cursor and checked rows of the list
 * @param {() => Promise<void>} settle - Refetches the Inbox and focuses the cursor row
 * @returns {(verb: string, results: readonly BulkProposalResult[]) => Promise<void>} - Finish function, verb in past tense
 */
export const useInboxBulkFinish = (
  selection: ListSelection<string>,
  settle: () => Promise<void>,
): ((verb: string, results: readonly BulkProposalResult[]) => Promise<void>) => {
  const dataVersion = useDataVersionStore()

  return async (verb, results) => {
    const text = bulkResultText(verb, results)

    ;(text.wrote ? notifySuccess : notifyNotice)(text.title, text.description)
    selection.checkedIds.value = withoutKeys(selection.checkedIds.value, handledKeys(results))

    if (text.wrote) {
      dataVersion.bump()
    }

    await settle()
  }
}
