import { computed, ref, shallowRef, type ComputedRef, type Ref, type ShallowRef } from 'vue'

import { isTokenLive } from '#core/apiToken.ts'
import type { ApiTokenCreateRequest, ApiTokenCreateResponse, ApiTokenView } from '#core/apiTypes.ts'
import { errorMessage } from '@/api/apiRequest'
import { createToken, fetchTokens, revokeToken } from '@/api/tokensApi'

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
  clearSecret: () => void
}

/**
 * Holds the personal API tokens of the acting user for the token dialog, and the secret of a new
 * token until it is dismissed.
 * @returns {ApiTokens} - Token state and actions
 */
export const useApiTokens = (): ApiTokens => {
  const list = ref<ApiTokenView[]>([])
  const loading = ref(false)
  const loadError = ref<string | null>(null)
  const created = shallowRef<ApiTokenCreateResponse | null>(null)

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
  }

  /**
   * Drops the secret of the token created last.
   * @returns {void}
   */
  const clearSecret = (): void => {
    created.value = null
  }

  return { tokens, loading, loadError, created, load, create, revoke, clearSecret }
}
