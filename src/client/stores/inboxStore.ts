import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { compareInboxItems, countInboxItems } from '#core/inbox/buildInbox.ts'
import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { errorMessage } from '@/api/apiRequest'
import { fetchInbox, markInboxSeen } from '@/api/inboxApi'
import { inboxItemsForFinding, type InboxFindingTarget } from '#core/inbox/findingInboxItems.ts'
import { isSeeable } from '@/components/inbox/inboxItems'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { createVisiblePoll } from '@/stores/visiblePoll'
import { notifyError, notifySuccess } from '@/toast/toastManager'

export const INBOX_POLL_MS = 30 * 1000

/**
 * Holds the Inbox of the acting user: open proposals, re-opened and expiring decisions and new
 * KEV listings, in Inbox order, with their counts, and the items per finding for the markers in
 * the list views and the finding panel. Polls every 30 seconds while the page is
 * visible and refetches when the data version moves. The newest request wins, a failed refetch
 * keeps the last answer. Marking items as seen removes them at once and puts them back when the
 * server refuses.
 */
export const useInboxStore = defineStore('inbox', () => {
  const dataVersion = useDataVersionStore()

  const items = ref<InboxItem[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const pendingSeen = new Set<string>()
  let request = 0

  const counts = computed(() => countInboxItems(items.value))
  const byVuln = computed(() => {
    const map = new Map<string, InboxItem[]>()

    for (const item of items.value) {
      map.set(item.vulnId, [...(map.get(item.vulnId) ?? []), item])
    }

    return map
  })

  /**
   * Returns the Inbox items that concern a finding, most relevant first.
   * @param {InboxFindingTarget} finding - Finding with its governing decision
   * @returns {InboxItem[]} - Proposals, re-opened decisions, new KEV listings, expiring decisions
   */
  const itemsFor = (finding: InboxFindingTarget): InboxItem[] =>
    inboxItemsForFinding(byVuln.value.get(finding.vulnId) ?? [], finding)

  /**
   * Fetches the Inbox, leaving out items a mark in flight already removed.
   * @returns {Promise<void>} - Resolves when stored or the error recorded
   */
  const refresh = async (): Promise<void> => {
    const current = ++request

    try {
      const next = await fetchInbox()

      if (current === request) {
        items.value = next.items.filter((item) => !pendingSeen.has(item.key))
        loaded.value = true
        error.value = null
      }
    } catch (failure) {
      if (current === request) {
        error.value = errorMessage(failure)
      }
    }
  }

  /**
   * Fetches the Inbox unless loaded.
   * @returns {Promise<void>} - Resolves when loaded
   */
  const ensureLoaded = async (): Promise<void> => {
    if (!loaded.value) {
      await refresh()
    }
  }

  /**
   * Marks items as seen: removes them at once, confirms with a toast, and puts them back with an
   * error toast when the request fails. Proposals and re-opened decisions are skipped.
   * @param {readonly string[]} keys - Item keys
   * @returns {Promise<boolean>} - Whether the server stored the marks
   */
  const markSeen = async (keys: readonly string[]): Promise<boolean> => {
    const wanted = new Set(keys)
    const removed = items.value.filter((item) => wanted.has(item.key) && isSeeable(item))

    if (removed.length === 0) {
      return false
    }

    const removedKeys = removed.map((item) => item.key)

    removedKeys.forEach((key) => pendingSeen.add(key))
    items.value = items.value.filter((item) => !removed.includes(item))

    try {
      await markInboxSeen(removedKeys)
      notifySuccess(
        removed.length === 1 ? 'Marked as seen' : `Marked ${removed.length} as seen`,
        removed.length === 1 ? removed[0]!.vulnId : undefined,
      )
      return true
    } catch (failure) {
      const listed = new Set(items.value.map((item) => item.key))

      items.value = [...items.value, ...removed.filter((item) => !listed.has(item.key))].sort(
        compareInboxItems,
      )
      notifyError('Could not mark as seen', failure)
      return false
    } finally {
      removedKeys.forEach((key) => pendingSeen.delete(key))
    }
  }

  const poll = createVisiblePoll(refresh, INBOX_POLL_MS)

  watch(
    () => dataVersion.version,
    () => {
      if (loaded.value) {
        void refresh()
      }
    },
  )

  return {
    items,
    counts,
    itemsFor,
    loaded,
    error,
    refresh,
    ensureLoaded,
    markSeen,
    startPolling: poll.start,
    stopPolling: poll.stop,
  }
})
