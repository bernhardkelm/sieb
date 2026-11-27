import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AccessTestResult } from '#core/privateAccess.ts'
import {
  button,
  field,
  mountAccessPage,
  pickProvider,
  press,
  submitForm,
  type,
} from '@/__tests__/accessPage'
import {
  buildCredential,
  buildCredentialsResponse,
  buildTestResult,
} from '@/__tests__/credentialBuilders'
import type { RoutedMount } from '@/__tests__/mountWithRouter'
import { ApiError } from '@/api/ApiError'
import {
  createCredential,
  deleteCredential,
  fetchCredentials,
  testCredential,
  testCredentialValues,
  updateCredential,
} from '@/api/credentialsApi'
import { UNTESTED_CONFIRM_LABEL } from '@/format/accessTestText'

vi.mock('@/api/credentialsApi', () => ({
  fetchCredentials: vi.fn<typeof fetchCredentials>(),
  createCredential: vi.fn<typeof createCredential>(),
  updateCredential: vi.fn<typeof updateCredential>(),
  deleteCredential: vi.fn<typeof deleteCredential>(),
  testCredential: vi.fn<typeof testCredential>(),
  testCredentialValues: vi.fn<typeof testCredentialValues>(),
}))

const SECRET = 'gldt-example-secret-value'
const UNTESTABLE: AccessTestResult = buildTestResult({
  registry: {
    checked: 2,
    ok: 0,
    blocked: 2,
    failures: [
      { target: 'registry.gitlab.com/your-group/shop', reason: 'address not allowed' },
      { target: 'registry.gitlab.com/your-group/lib', reason: 'address not allowed' },
    ],
  },
  git: {
    checked: 1,
    ok: 0,
    blocked: 1,
    failures: [{ target: 'https://gitlab.com/your-group/shop', reason: 'address not allowed' }],
  },
})

let mounted: RoutedMount | null = null

/**
 * Opens the add form for GitLab and fills it.
 * @returns {Promise<void>}
 */
const fillAddForm = async (): Promise<void> => {
  vi.mocked(fetchCredentials).mockResolvedValue(buildCredentialsResponse())
  mounted = await mountAccessPage()
  await press('Add credential')
  await pickProvider('GitLab')
  type('Label', 'GitLab your-group')
  type('Path prefix', 'your-group/')
  type('Username', 'gitlab+deploy-token-12')
  type('Token', SECRET)
}

/**
 * Returns a refusal of the save as the API answers it.
 * @param {string} code - test_failed, nothing_to_test or untestable
 * @param {AccessTestResult} result - Test result
 * @returns {ApiError} - Error
 */
const refusal = (code: string, result: AccessTestResult): ApiError =>
  new ApiError(422, { error: code, result }, '/api/credentials')

/**
 * Returns the text of the open form.
 * @returns {string} - Text
 */
const formText = (): string => document.body.querySelector('form.credential-form')!.textContent!

/**
 * Returns the checkbox that confirms saving without a test.
 * @returns {HTMLInputElement | undefined} - Checkbox, undefined while it does not show
 */
const confirmBox = (): HTMLInputElement | undefined =>
  [...document.body.querySelectorAll('label')]
    .find((label) => label.textContent?.trim() === UNTESTED_CONFIRM_LABEL)
    ?.querySelector('input') ?? undefined

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('AccessView credential test', () => {
  it('tests and saves, with a progress line while the test runs', async () => {
    let finish: (value: ReturnType<typeof buildCredential>) => void = () => {}

    await fillAddForm()
    vi.mocked(createCredential).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    expect(button('Test and save')).toBeDefined()
    await submitForm()

    expect(document.body.querySelector('[role="status"]')?.textContent).toContain(
      'Testing the token on the covered images and repositories before saving',
    )
    expect(button('Test and save')!.disabled).toBe(true)

    finish(buildCredential({ lastTest: buildTestResult() }))
    await flushPromises()

    expect(document.body.querySelector('form.credential-form')).toBeNull()
  })

  it('keeps the form open with the result and the hidden token when the test refuses the save', async () => {
    await fillAddForm()
    vi.mocked(createCredential).mockRejectedValue(refusal('test_failed', buildTestResult()))
    await submitForm()

    expect(formText()).toContain('Not saved: the test failed.')
    expect(formText()).toContain('Images: 2 of 2 reachable')
    expect(formText()).toContain('Repositories: 0 of 1 reachable')
    expect(formText()).toContain('https://gitlab.com/your-group/shop: 403 forbidden')
    expect(field('Token')!.value).toBe(SECRET)
    expect(field('Token')!.type).toBe('password')
    expect(document.body.innerHTML).not.toContain(SECRET)
    expect(confirmBox()).toBeUndefined()
  })

  it('explains a prefix that covers nothing', async () => {
    await fillAddForm()
    vi.mocked(createCredential).mockRejectedValue(
      refusal(
        'nothing_to_test',
        buildTestResult({
          registry: { checked: 0, ok: 0, failures: [] },
          git: { checked: 0, ok: 0, failures: [] },
        }),
      ),
    )
    await submitForm()

    expect(formText()).toContain('the path prefix covers no image or repository sieb has seen')
    expect(confirmBox()).toBeUndefined()
  })

  it('offers saving untested only for hosts sieb may not reach and sends the confirmation', async () => {
    await fillAddForm()
    vi.mocked(createCredential).mockRejectedValueOnce(refusal('untestable', UNTESTABLE))
    await submitForm()

    expect(formText()).toContain('private or in-cluster addresses')
    expect(formText()).toContain('the fetcher can still use them')

    confirmBox()!.click()
    vi.mocked(createCredential).mockResolvedValue(buildCredential())
    await submitForm()

    expect(createCredential).toHaveBeenLastCalledWith(
      expect.objectContaining({ confirmUntested: true, secret: SECRET }),
    )
  })

  it('tests only without saving', async () => {
    await fillAddForm()
    vi.mocked(testCredentialValues).mockResolvedValue(
      buildTestResult({ git: { checked: 1, ok: 1, failures: [] } }),
    )
    await press('Test only')

    expect(testCredentialValues).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'gitlab', secret: SECRET }),
    )
    expect(createCredential).not.toHaveBeenCalled()
    expect(formText()).toContain('The test passed. Nothing is saved yet.')
    expect(field('Token')!.value).toBe(SECRET)
  })

  it('names the test in the edit button only when more than the label changes', async () => {
    vi.mocked(fetchCredentials).mockResolvedValue(
      buildCredentialsResponse({ credentials: [buildCredential()] }),
    )
    mounted = await mountAccessPage()
    await press('Edit GitLab your-group')
    type('Label', 'Renamed')
    await flushPromises()

    expect(button('Save changes')).toBeDefined()

    type('Path prefix', 'your-group/shop')
    await flushPromises()

    expect(button('Test and save changes')).toBeDefined()

    vi.mocked(testCredentialValues).mockResolvedValue(buildTestResult())
    await press('Test only')

    expect(testCredentialValues).toHaveBeenCalledWith({
      id: 1,
      label: 'Renamed',
      pathPrefix: 'your-group/shop',
      repoMapping: null,
      username: 'gitlab+deploy-token-12',
    })
  })
})
