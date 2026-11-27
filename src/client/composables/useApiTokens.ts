import { computed, ref, shallowRef, type ComputedRef, type Ref, type ShallowRef } from 'vue'

import { isTokenLive } from '#core/apiToken.ts'
import type {
  ApiTokenCreateRequest,
  ApiTokenCreateResponse,
  ApiTokenView,
} from '#core/tokenApiTypes.ts'
import { ApiError } from '@/api/ApiError'
import { errorMessage } from '@/api/apiRequest'
import { cleanupTokens, createToken, deleteToken, fetchTokens, revokeToken } from '@/api/tokensApi'
import { useMcpStore } from '@/stores/mcpStore'

export interface ApiTokens {
  /** Live tokens first, then revoked and expired ones, each newest first */
  tokens: ComputedRef<ApiTokenView[]>
  loading: Ref<boolean>
  loadError: Ref<string | null>
  /** Token created last with its secret, null once the secret was dismissed */
  created: ShallowRef<ApiTokenCreateResponse | null>
  load: () => Promise<void>
  create: (input: ApiTokenCreateRequest) => Promise<void>
  revoke: (id: number) => Promise<void>
  /** Deletes a revoked or expired token, one already gone just leaves the list */
  remove: (id: number) => Promise<void>
  /** Deletes every revoked or expired token, reloads the list and resolves the count */
  clearInactive: () => Promise<number>
  clearSecret: () => void
}

/**
 * Holds the personal API tokens of the acting user for the token dialog, and the secret of a new
 * token until it is dismissed. Each change refreshes the MCP info, so the hand-off actions follow
 * whether a live token connects Claude.
 * @returns {ApiTokens} - Token state and actions
 */
export const useApiTokens = (): ApiTokens => {
  const list = ref<ApiTokenView[]>([])
  const loading = ref(false)
  const loadError = ref<string | null>(null)
  const created = shallowRef<ApiTokenCreateResponse | null>(null)
  const mcp = useMcpStore()

  const tokens = computed(() => {
    const now = new Date()

    return [
      ...list.value.filter((token) => isTokenLive(token, now)),
      ...list.value.filter((token) => !isTokenLive(token, now)),
    ]
  })

  /**
   * Fetches the tokens.
   * @returns {Promise<void>}
   */
  const load = async (): Promise<void> => {
    loading.value = true
    loadError.value = null

    try {
      list.value = await fetchTokens()
    } catch (error) {
      loadError.value = errorMessage(error)
    } finally {
      loading.value = false
    }
  }

  /**
   * Creates a token and keeps its secret for the one-time display.
   * @param {ApiTokenCreateRequest} input - Name, scope and expiry
   * @returns {Promise<void>}
   * @throws {ApiError} - When the server refuses the token
   */
  const create = async (input: ApiTokenCreateRequest): Promise<void> => {
    const result = await createToken(input)

    list.value = [result.token, ...list.value.filter((token) => token.id !== result.token.id)]
    created.value = result
    void mcp.refresh()
  }

  /**
   * Revokes a token and replaces it in the list.
   * @param {number} id - Token id
   * @returns {Promise<void>}
   * @throws {ApiError} - When the token is unknown
   */
  const revoke = async (id: number): Promise<void> => {
    const revoked = await revokeToken(id)

    list.value = list.value.map((token) => (token.id === id ? revoked : token))
    void mcp.refresh()
  }

  /**
   * Deletes a revoked or expired token and drops it from the list, also when the server no
   * longer knows it.
   * @param {number} id - Token id
   * @returns {Promise<void>}
   * @throws {ApiError} - 409 token_live while the token still authenticates
   */
  const remove = async (id: number): Promise<void> => {
    try {
      await deleteToken(id)
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) {
        throw error
      }
    }

    list.value = list.value.filter((token) => token.id !== id)
    void mcp.refresh()
  }

  /**
   * Deletes every revoked or expired token and reloads the list from the server.
   * @returns {Promise<number>} - Number of deleted tokens
   * @throws {ApiError} - When the server refuses the cleanup
   */
  const clearInactive = async (): Promise<number> => {
    const { deleted } = await cleanupTokens()

    await load()
    void mcp.refresh()
    return deleted
  }

  /**
   * Drops the secret of the token created last.
   * @returns {void}
   */
  const clearSecret = (): void => {
    created.value = null
  }

  return {
    tokens,
    loading,
    loadError,
    created,
    load,
    create,
    revoke,
    remove,
    clearInactive,
    clearSecret,
  }
}
