import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/ApiError'
import { apiRequest, errorMessage } from '@/api/apiRequest'
import { queryString } from '@/api/queryString'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiRequest', () => {
  it('sends JSON and parses the answer', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ id: 1 }, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await apiRequest('/api/decisions', 'POST', { reason: 'x' })).toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledWith('/api/decisions', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{"reason":"x"}',
    })
  })

  it('sends the JSON content type on writes without a body, not on reads', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({}))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/api/sync', 'POST')
    await apiRequest('/api/sync')

    expect(fetchMock.mock.calls[0]![1]).toEqual({
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    })
    expect(fetchMock.mock.calls[1]![1]).toEqual({
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
  })

  it('describes known guard errors readably', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ error: 'forbidden_host' }, { status: 403 }))

    const error = await apiRequest('/api/sync', 'POST').catch((thrown: unknown) => thrown)

    expect(errorMessage(error)).toBe('The server does not accept requests for this host name.')
    expect(errorMessage(new ApiError(500, {}, '/api/x'))).toBe('API answered 500 error for /api/x')
  })

  it('throws an ApiError carrying status and validation errors', async () => {
    const body = { error: 'validation', errors: [{ field: 'reason', code: 'required' }] }
    vi.stubGlobal('fetch', async () => Response.json(body, { status: 400 }))

    const error = await apiRequest('/api/decisions', 'POST', {}).catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, code: 'validation', isValidation: true })
    expect((error as ApiError).fieldErrors('reason')).toEqual(['required'])
  })
})

describe('queryString', () => {
  it('joins lists and leaves out empty values', () => {
    expect(queryString({ view: 'inbox', severity: ['Critical', 'High'], q: '', owner: [] })).toBe(
      '?view=inbox&severity=Critical%2CHigh',
    )
    expect(queryString({ includeResolved: false, state: undefined })).toBe('')
  })
})
