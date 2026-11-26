import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/ApiError'
import { cleanupTokens, deleteToken } from '@/api/tokensApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('tokensApi', () => {
  it('deletes a token with DELETE, the JSON content type and no body, 204 resolves empty', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await deleteToken(7)).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/tokens/7', {
      method: 'DELETE',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    })
  })

  it('rejects a live token with the token_live code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => Response.json({ error: 'token_live' }, { status: 409 })),
    )

    await expect(deleteToken(7)).rejects.toMatchObject({ status: 409, code: 'token_live' })
    await expect(deleteToken(7)).rejects.toBeInstanceOf(ApiError)
  })

  it('clears the inactive tokens through POST /api/tokens/cleanup', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ deleted: 3 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await cleanupTokens()).toEqual({ deleted: 3 })
    expect(fetchMock).toHaveBeenCalledWith('/api/tokens/cleanup', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    })
  })
})
