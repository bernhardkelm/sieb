import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiRequest } from '@/api/apiRequest'
import { onWriteSessionExpired, resetSession, setAuthMode } from '@/api/session'

const assign = vi.fn<(url: string) => void>()

/**
 * Stubs fetch with a 401 answer and a location with a known path.
 * @returns {void}
 */
const stub401 = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => Response.json({ error: 'unauthorized' }, { status: 401 })),
  )
  vi.stubGlobal('location', { pathname: '/inbox', search: '?q=a b', assign })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  resetSession()
})

describe('401 handling', () => {
  it('navigates to the login once for reads while the mode is unknown or oidc', async () => {
    stub401()
    void apiRequest('/api/findings')
    await vi.waitFor(() => expect(assign).toHaveBeenCalledOnce())

    expect(assign).toHaveBeenCalledExactlyOnceWith('/auth/login?return=%2Finbox%3Fq%3Da%20b')

    setAuthMode('oidc')

    await expect(apiRequest('/api/stats')).rejects.toMatchObject({ status: 401 })
  })

  it('notifies instead of navigating for writes', async () => {
    stub401()
    setAuthMode('oidc')
    const notify = vi.fn<() => void>()
    onWriteSessionExpired(notify)

    await expect(apiRequest('/api/decisions', 'POST', {})).rejects.toMatchObject({ status: 401 })

    expect(notify).toHaveBeenCalledOnce()
    expect(assign).not.toHaveBeenCalled()
  })

  it('keeps the plain error in header mode', async () => {
    stub401()
    setAuthMode('header')
    const notify = vi.fn<() => void>()
    onWriteSessionExpired(notify)

    await expect(apiRequest('/api/findings')).rejects.toMatchObject({ status: 401 })
    await expect(apiRequest('/api/decisions', 'POST', {})).rejects.toMatchObject({ status: 401 })

    expect(assign).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })
})
