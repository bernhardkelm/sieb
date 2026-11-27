import { computed, nextTick, ref, type ComputedRef, type Ref } from 'vue'

import { isTokenLive } from '#core/apiToken.ts'
import type { ApiTokenView } from '#core/tokenApiTypes.ts'
import { notifyError, notifySuccess } from '@/toast/toastManager'

export interface TokenDeletionDeps {
  /** Tokens as listed, live ones first */
  tokens: () => ApiTokenView[]
  now: Readonly<Ref<Date>>
  /** Element holding the rows, focused itself once no row is left */
  root: Ref<HTMLElement | null>
  remove: (id: number) => Promise<void>
  clearInactive: () => Promise<number>
}

export interface TokenDeletion {
  inactive: ComputedRef<ApiTokenView[]>
  /** Token id being deleted, 'all' while clearing, null when idle */
  busy: Ref<number | 'all' | null>
  deleteOne: (token: ApiTokenView) => Promise<void>
  deleteAll: () => Promise<void>
}

/**
 * Deletes revoked and expired tokens of the token list without confirmation, since they no longer
 * authenticate, reports the result in a toast and keeps the keyboard focus inside the list.
 * @param {TokenDeletionDeps} deps - Listed tokens, clock, list element and the delete actions
 * @returns {TokenDeletion} - Inactive tokens, busy state and the delete actions
 */
export const useTokenDeletion = ({
  tokens,
  now,
  root,
  remove,
  clearInactive,
}: TokenDeletionDeps): TokenDeletion => {
  const busy = ref<number | 'all' | null>(null)
  const inactive = computed(() => tokens().filter((token) => !isTokenLive(token, now.value)))

  /**
   * Focuses the delete button of a token, else the last row, else the list element.
   * @param {number | null} id - Token whose delete button takes the focus
   * @returns {Promise<void>}
   */
  const focusAfter = async (id: number | null): Promise<void> => {
    await nextTick()
    const element = root.value
    const button =
      id === null ? null : element?.querySelector<HTMLElement>(`[data-token-id="${id}"] .delete`)
    const target =
      button ??
      [...(element?.querySelectorAll<HTMLElement>('[data-token-id]') ?? [])].at(-1) ??
      element

    target?.focus()
  }

  /**
   * Deletes one inactive token and moves the focus to the delete button of its neighbour.
   * @param {ApiTokenView} token - Revoked or expired token
   * @returns {Promise<void>}
   */
  const deleteOne = async (token: ApiTokenView): Promise<void> => {
    const ids = inactive.value.map((candidate) => candidate.id)
    const index = ids.indexOf(token.id)
    const neighbour = ids[index + 1] ?? ids[index - 1] ?? null

    busy.value = token.id

    try {
      await remove(token.id)
    } catch (failure) {
      notifyError('Could not delete the token', failure)
      return
    } finally {
      busy.value = null
    }

    notifySuccess(`Deleted: ${token.name}`)
    await focusAfter(neighbour)
  }

  /**
   * Deletes every inactive token and moves the focus to the last remaining row.
   * @returns {Promise<void>}
   */
  const deleteAll = async (): Promise<void> => {
    let deleted: number

    busy.value = 'all'

    try {
      deleted = await clearInactive()
    } catch (failure) {
      notifyError('Could not delete the inactive tokens', failure)
      return
    } finally {
      busy.value = null
    }

    notifySuccess(`Deleted ${deleted} inactive ${deleted === 1 ? 'token' : 'tokens'}`)
    await focusAfter(null)
  }

  return { inactive, busy, deleteOne, deleteAll }
}
