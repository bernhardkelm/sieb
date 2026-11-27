import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildCredential,
  buildCredentialsResponse,
  buildTestResult,
} from '@/__tests__/credentialBuilders'
import { ApiError } from '@/api/ApiError'
import {
  createCredential,
  deleteCredential,
  fetchCredentials,
  testCredential,
  testCredentialValues,
  updateCredential,
} from '@/api/credentialsApi'
import { useCredentialsStore } from '@/stores/credentialsStore'

vi.mock('@/api/credentialsApi', () => ({
  fetchCredentials: vi.fn<typeof fetchCredentials>(),
  createCredential: vi.fn<typeof createCredential>(),
  updateCredential: vi.fn<typeof updateCredential>(),
  deleteCredential: vi.fn<typeof deleteCredential>(),
  testCredential: vi.fn<typeof testCredential>(),
  testCredentialValues: vi.fn<typeof testCredentialValues>(),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

/**
 * Returns a store loaded with one credential.
 * @returns {Promise<ReturnType<typeof useCredentialsStore>>} - Store
 */
const loadedStore = async (): Promise<ReturnType<typeof useCredentialsStore>> => {
  vi.mocked(fetchCredentials).mockResolvedValue(
    buildCredentialsResponse({ credentials: [buildCredential()] }),
  )
  const store = useCredentialsStore()

  await store.load()
  return store
}

describe('credentialsStore', () => {
  it('loads the switches and credentials, and keeps them when a reload fails', async () => {
    const store = await loadedStore()

    expect(store.loaded).toBe(true)
    expect(store.enabled).toBe(true)
    expect(store.fetcherConfigured).toBe(true)
    expect(store.credentials.map((credential) => credential.id)).toEqual([1])

    vi.mocked(fetchCredentials).mockRejectedValue(new Error('offline'))
    await store.load()

    expect(store.error).toBe('offline')
    expect(store.credentials).toHaveLength(1)
  })

  it('appends a created and replaces an updated credential', async () => {
    const store = await loadedStore()

    vi.mocked(createCredential).mockResolvedValue(buildCredential({ id: 2, label: 'Docker Hub' }))
    vi.mocked(updateCredential).mockResolvedValue(buildCredential({ label: 'Renamed' }))
    await store.create({
      provider: 'dockerhub',
      label: 'Docker Hub',
      uses: ['registry'],
      pathPrefix: '',
      username: 'example',
      secret: 'dckr_pat_example',
    })
    await store.update(1, { label: 'Renamed' })

    expect(store.credentials.map((credential) => credential.label)).toEqual([
      'Renamed',
      'Docker Hub',
    ])
    expect(updateCredential).toHaveBeenCalledWith(1, { label: 'Renamed' })
  })

  it('drops a deleted credential, also one the server no longer knows', async () => {
    const store = await loadedStore()

    vi.mocked(deleteCredential).mockRejectedValue(
      new ApiError(404, { error: 'not_found' }, '/api/credentials/1'),
    )
    await store.remove(1)

    expect(store.credentials).toEqual([])
  })

  it('marks a credential as testing and stores the tested credential', async () => {
    const store = await loadedStore()
    let finish: (value: ReturnType<typeof buildCredential>) => void = () => {}

    vi.mocked(testCredential).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const running = store.test(1)

    expect(store.isTesting(1)).toBe(true)
    expect(await store.test(1)).toBeNull()

    finish(buildCredential({ lastTest: buildTestResult() }))
    const result = await running

    expect(store.isTesting(1)).toBe(false)
    expect(result?.git?.ok).toBe(0)
    expect(store.credentials[0]?.lastTest?.git?.ok).toBe(0)
    expect(testCredential).toHaveBeenCalledTimes(1)
  })

  it('tests entered values and leaves the list as it is', async () => {
    const store = await loadedStore()
    const before = store.credentials

    vi.mocked(testCredentialValues).mockResolvedValue(buildTestResult())

    expect(await store.testValues({ id: 1, pathPrefix: 'your-group/shop' })).toEqual(
      buildTestResult(),
    )
    expect(testCredentialValues).toHaveBeenCalledWith({ id: 1, pathPrefix: 'your-group/shop' })
    expect(store.credentials).toBe(before)
  })
})
