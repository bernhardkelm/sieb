import { computed, nextTick, watch, type ComputedRef, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { findingIdOfItem, proposalItemKey } from '@/components/inbox/inboxItems'
import { useFindingPanel } from '@/composables/useFindingPanel'
import { withQueryParam } from '@/router/queryParam'
import { FINDING_QUERY, PROPOSAL_PARAM, ROUTE_NAMES } from '@/router/routeNames'

export interface InboxPanels {
  /** Proposal shown in the review panel, null while it is closed */
  proposalId: ComputedRef<number | null>
  openItem: (item: InboxItem) => Promise<void>
  closeProposal: () => Promise<void>
  /** Closes the topmost panel, the finding panel before the review panel */
  closeTop: () => boolean
}

/**
 * Opens Inbox items in their panels: a proposal in the review panel at
 * `/inbox/proposals/<id>`, an item with a finding in the finding panel over the Inbox, a
 * decision without open findings on the decisions view. A proposal opened by link puts the
 * cursor on its row once listed. Closing the review panel returns focus to the cursor row.
 * How the panels react to cursor moves lives in useInboxCursorPanels.
 * @param {Ref<string | null>} currentKey - Cursor row
 * @param {Readonly<Ref<readonly InboxItem[]>>} items - Listed items
 * @param {() => Promise<void>} refocus - Focuses the cursor row
 * @returns {InboxPanels} - Open proposal and the panel actions
 */
export const useInboxPanels = (
  currentKey: Ref<string | null>,
  items: Readonly<Ref<readonly InboxItem[]>>,
  refocus: () => Promise<void>,
): InboxPanels => {
  const route = useRoute()
  const router = useRouter()
  const { findingId, closeFinding } = useFindingPanel()

  const proposalId = computed(() =>
    route.name === ROUTE_NAMES.INBOX_PROPOSAL ? Number(route.params[PROPOSAL_PARAM]) : null,
  )

  /**
   * Opens an item in its panel, or the decisions view for a decision without open findings.
   * @param {InboxItem} item - Item
   * @returns {Promise<void>} - Resolves after the navigation
   */
  const openItem = async (item: InboxItem): Promise<void> => {
    const query = withQueryParam(route.query, FINDING_QUERY, null)

    if (item.kind === 'proposal') {
      await router.replace({
        name: ROUTE_NAMES.INBOX_PROPOSAL,
        params: { [PROPOSAL_PARAM]: String(item.refs.proposalId) },
        query,
      })
      return
    }

    const finding = findingIdOfItem(item)

    if (finding !== null) {
      await router.replace({
        name: ROUTE_NAMES.INBOX,
        query: { ...query, [FINDING_QUERY]: finding },
      })
      return
    }

    await router.push({
      name: ROUTE_NAMES.DECISIONS,
      query: Object.fromEntries(new URL(item.url).searchParams),
    })
  }

  /**
   * Closes the review panel, keeping the query, and focuses the cursor row once focus left
   * with the panel. Focus a press outside the panel put elsewhere stays there.
   * @returns {Promise<void>} - Resolves once focused
   */
  const closeProposal = async (): Promise<void> => {
    await router.replace({ name: ROUTE_NAMES.INBOX, query: route.query })
    await nextTick()

    if (document.activeElement === null || document.activeElement === document.body) {
      await refocus()
    }
  }

  /**
   * Closes the finding panel when open, else the review panel.
   * @returns {boolean} - Whether a panel was open
   */
  const closeTop = (): boolean => {
    if (findingId.value !== null) {
      void closeFinding()
      return true
    }

    if (proposalId.value !== null) {
      void closeProposal()
      return true
    }

    return false
  }

  watch(
    () => {
      const key = proposalId.value === null ? null : proposalItemKey(proposalId.value)

      return items.value.some((item) => item.key === key) ? key : null
    },
    (key) => {
      if (key !== null) {
        currentKey.value = key
      }
    },
    { immediate: true },
  )

  return { proposalId, openItem, closeProposal, closeTop }
}
