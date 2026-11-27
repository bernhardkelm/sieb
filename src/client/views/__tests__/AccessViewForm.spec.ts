import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  button,
  field,
  mountAccessPage,
  pickProvider,
  press,
  submitForm,
  type,
} from '@/__tests__/accessPage'
import { buildCredential, buildCredentialsResponse } from '@/__tests__/credentialBuilders'
import type { RoutedMount } from '@/__tests__/mountWithRouter'
import { ApiError } from '@/api/ApiError'
import {
  createCredential,
  deleteCredential,
  fetchCredentials,
  testCredential,
  updateCredential,
} from '@/api/credentialsApi'
import { notifySuccess } from '@/toast/toastManager'

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
}))

const SECRET = 'gldt-example-secret-value'

let mounted: RoutedMount | null = null

/**
 * Opens the add form on a page with the given credentials.
 * @param {ReturnType<typeof buildCredential>[]} credentials - Stored credentials
 * @returns {Promise<void>}
 */
const openAddForm = async (
  credentials: ReturnType<typeof buildCredential>[] = [],
): Promise<void> => {
  vi.mocked(fetchCredentials).mockResolvedValue(buildCredentialsResponse({ credentials }))
  mounted = await mountAccessPage()
  await press('Add credential')
}

/**
 * Returns the text of the open form.
 * @returns {string} - Text
 */
const formText = (): string => document.body.querySelector('form.credential-form')!.textContent!

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('AccessView form', () => {
  it('starts with GitHub: both uses, fixed hosts, no username, both token instructions', async () => {
    await openAddForm()

    expect(field('Username')).toBeNull()
    expect(field('Registry host')).toBeNull()
    expect(formText()).toContain('fine-grained personal access token')
    expect(formText()).toContain('Contents: Read-only')
    expect(formText()).toContain('read:packages')
    expect(formText()).toContain('add two credentials')
    expect(formText()).toContain('sent to Anthropic')
    expect(field('Token')!.type).toBe('password')
  })

  it('shows hosts and username for GitLab and only the registry for Docker Hub', async () => {
    await openAddForm()
    await pickProvider('GitLab')

    expect(field('Registry host')!.value).toBe('registry.gitlab.com')
    expect(field('Git host')!.value).toBe('gitlab.com')
    expect(field('Username')).not.toBeNull()
    expect(formText()).toContain('read_registry')
    expect(formText()).toContain('registry.gitlab.com/your-group/* and gitlab.com/your-group/*')

    await pickProvider('Docker Hub')

    const checkboxes = [...document.body.querySelectorAll<HTMLInputElement>('[type="checkbox"]')]

    expect(checkboxes).toHaveLength(1)
    expect(checkboxes[0]!.disabled).toBe(true)
    expect(field('Registry host')).toBeNull()
    expect(formText()).not.toContain('Repository mapping')
    expect(formText()).toContain('Public Repo Read-only cannot pull private images')
  })

  it('checks the form locally before sending it', async () => {
    await openAddForm()
    await submitForm()

    expect(createCredential).not.toHaveBeenCalled()
    expect(formText()).toContain('A label is required.')
    expect(formText()).toContain('The token is required.')
    expect(field('Label')!.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(field('Label'))
  })

  it('shows the validation errors of the server at their fields', async () => {
    await openAddForm()
    await pickProvider('GitLab')
    type('Label', 'GitLab your-group')
    type('Username', 'gitlab+deploy-token-12')
    type('Token', SECRET)
    vi.mocked(createCredential).mockRejectedValue(
      new ApiError(
        400,
        { error: 'validation', errors: [{ field: 'gitHost', code: 'invalid' }] },
        '/api/credentials',
      ),
    )
    await submitForm()

    expect(field('Git host')!.getAttribute('aria-invalid')).toBe('true')
    expect(formText()).toContain('Not a valid value.')
    expect(document.activeElement).toBe(field('Git host'))
  })

  it('adds a credential and never shows its token again', async () => {
    await openAddForm()
    await pickProvider('GitLab')
    type('Label', ' GitLab your-group ')
    type('Path prefix', 'your-group/')
    type('Username', 'gitlab+deploy-token-12')
    type('Token', SECRET)
    vi.mocked(createCredential).mockResolvedValue(buildCredential())
    await submitForm()

    expect(createCredential).toHaveBeenCalledWith({
      provider: 'gitlab',
      label: 'GitLab your-group',
      uses: ['registry', 'git'],
      registryHost: 'registry.gitlab.com',
      gitHost: 'gitlab.com',
      pathPrefix: 'your-group/',
      repoMapping: null,
      username: 'gitlab+deploy-token-12',
      secret: SECRET,
    })
    expect(document.body.querySelector('form.credential-form')).toBeNull()
    expect(document.activeElement).toBe(document.body.querySelector('[data-credential-id="1"]'))
    expect(notifySuccess).toHaveBeenCalledWith('Credential added', 'GitLab your-group')

    await press('Edit GitLab your-group')

    expect(field('Replace token')!.value).toBe('')
    expect(document.body.innerHTML).not.toContain(SECRET)
  })

  it('edits label and prefix and keeps the stored token while none is typed', async () => {
    await openAddForm([buildCredential()])
    await press('Cancel')
    await press('Edit GitLab your-group')

    expect(field('Username')!.value).toBe('gitlab+deploy-token-12')
    expect(field('Registry host')).toBeNull()

    type('Label', 'Renamed')
    vi.mocked(updateCredential).mockResolvedValue(buildCredential({ label: 'Renamed' }))
    await submitForm()

    expect(updateCredential).toHaveBeenCalledWith(1, {
      label: 'Renamed',
      pathPrefix: 'your-group/',
      repoMapping: null,
      username: 'gitlab+deploy-token-12',
    })
    expect(button('Edit Renamed')).toBeDefined()
  })
})
