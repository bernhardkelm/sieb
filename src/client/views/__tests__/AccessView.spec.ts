import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { button, mountAccessPage, press } from '@/__tests__/accessPage'
import {
  buildCredential,
  buildCredentialsResponse,
  buildTestResult,
} from '@/__tests__/credentialBuilders'
import type { RoutedMount } from '@/__tests__/mountWithRouter'
import {
  createCredential,
  deleteCredential,
  fetchCredentials,
  testCredential,
  updateCredential,
} from '@/api/credentialsApi'
import { notifyNotice, notifySuccess } from '@/toast/toastManager'

vi.mock('@/api/credentialsApi', () => ({
  fetchCredentials: vi.fn<typeof fetchCredentials>(),
  createCredential: vi.fn<typeof createCredential>(),
  updateCredential: vi.fn<typeof updateCredential>(),
  deleteCredential: vi.fn<typeof deleteCredential>(),
  testCredential: vi.fn<typeof testCredential>(),
}))

vi.mock('@/toast/toastManager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/toast/toastManager')>()),
  notifySuccess: vi.fn<typeof notifySuccess>(),
  notifyNotice: vi.fn<typeof notifyNotice>(),
}))

let mounted: RoutedMount | null = null

/**
 * Mounts the page with a credentials answer.
 * @param {Parameters<typeof buildCredentialsResponse>[0]} answer - Answer fields
 * @returns {Promise<void>}
 */
const showPage = async (answer: Parameters<typeof buildCredentialsResponse>[0]): Promise<void> => {
  vi.mocked(fetchCredentials).mockResolvedValue(buildCredentialsResponse(answer))
  mounted = await mountAccessPage()
}

/**
 * Returns the list item of a credential.
 * @param {number} id - Credential id
 * @returns {HTMLElement | null} - Item
 */
const item = (id: number): HTMLElement | null =>
  document.body.querySelector<HTMLElement>(`[data-credential-id="${id}"]`)

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('AccessView', () => {
  it('explains what the operator sets while credentials are off', async () => {
    await showPage({ enabled: false, fetcherConfigured: false })

    expect(document.body.textContent).toContain('Credentials are off')
    expect(document.body.textContent).toContain('SIEB_CREDENTIALS_KEY')
    expect(button('Add credential')).toBeUndefined()
  })

  it('warns without the fetcher and offers the first credential on an empty list', async () => {
    await showPage({ fetcherConfigured: false })

    expect(document.body.textContent).toContain('The fetcher is not configured')
    expect(document.body.textContent).toContain('No credentials yet')

    await press('Add credential')

    expect(document.body.querySelector('form.credential-form')).not.toBeNull()
    expect(document.activeElement?.getAttribute('role')).toBe('radio')
  })

  it('lists a credential with its hosts, prefix, uses, username, author and last test', async () => {
    await showPage({
      credentials: [
        buildCredential({
          lastTest: buildTestResult(),
          repoMapping: {
            registryPrefix: 'registry.gitlab.com/your-group/',
            repoPrefix: 'gitlab.com/your-group/',
          },
        }),
      ],
    })

    const text = item(1)!.textContent!

    expect(text).toContain('GitLab')
    expect(text).toContain('GitLab your-group')
    expect(text).toContain('Registry and Git')
    expect(text).toContain('registry.gitlab.com/your-group/*')
    expect(text).toContain('gitlab.com/your-group/*')
    expect(text).toContain('gitlab+deploy-token-12')
    expect(text).toContain('registry.gitlab.com/your-group/ to gitlab.com/your-group/')
    expect(text).toContain('alice')
    expect(text).toContain('never used')
    expect(text).toContain('Images: 2 of 2 reachable')
    expect(text).toContain('Repositories: 0 of 1 reachable')
    expect(text).toContain('https://gitlab.com/your-group/shop: 403 forbidden')
  })

  it('shows the test in progress, then its result and a toast', async () => {
    await showPage({ credentials: [buildCredential()] })
    let finish: (value: ReturnType<typeof buildCredential>) => void = () => {}

    vi.mocked(testCredential).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await press('Test GitLab your-group')

    expect(item(1)!.textContent).toContain('Testing access')
    expect(button('Test GitLab your-group')!.getAttribute('aria-busy')).toBe('true')

    finish(buildCredential({ lastTest: buildTestResult() }))
    await flushPromises()

    expect(item(1)!.textContent).toContain('Repositories: 0 of 1 reachable')
    expect(item(1)!.textContent).not.toContain('Testing access')
    expect(notifyNotice).toHaveBeenCalledWith(
      'GitLab your-group: not everything reachable',
      'Images: 2 of 2 reachable. Repositories: 0 of 1 reachable.',
    )
  })

  it('flags a token sealed with another key and blocks its test', async () => {
    await showPage({ credentials: [buildCredential({ secretReadable: false })] })

    expect(item(1)!.textContent).toContain('Token unreadable')
    expect(button('Test GitLab your-group')!.getAttribute('aria-disabled')).toBe('true')

    await press('Test GitLab your-group')

    expect(testCredential).not.toHaveBeenCalled()
  })

  it('deletes a credential only after the confirmation', async () => {
    await showPage({ credentials: [buildCredential()] })
    vi.mocked(deleteCredential).mockResolvedValue(undefined)

    await press('Delete GitLab your-group')

    const dialog = document.body.querySelector('[role="alertdialog"]')!

    expect(dialog.textContent).toContain('Delete GitLab your-group?')
    expect(deleteCredential).not.toHaveBeenCalled()

    await press('Delete credential')

    expect(deleteCredential).toHaveBeenCalledWith(1)
    expect(item(1)).toBeNull()
    expect(notifySuccess).toHaveBeenCalledWith('Credential deleted', 'GitLab your-group')
  })
})
