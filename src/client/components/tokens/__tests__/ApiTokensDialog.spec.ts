import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import type { ApiTokenView, McpInfoResponse } from '#core/apiTypes.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import { ApiError } from '@/api/ApiError'
import {
  cleanupTokens,
  createToken,
  deleteToken,
  fetchMcpInfo,
  fetchTokens,
  revokeToken,
} from '@/api/tokensApi'
import ApiTokensDialog from '@/components/tokens/ApiTokensDialog.vue'
import { useMcpStore } from '@/stores/mcpStore'
import { notifyError, notifySuccess } from '@/toast/toastManager'

vi.mock('@/api/tokensApi', () => ({
  fetchTokens: vi.fn<typeof fetchTokens>(),
  createToken: vi.fn<typeof createToken>(),
  revokeToken: vi.fn<typeof revokeToken>(),
  deleteToken: vi.fn<typeof deleteToken>(),
  cleanupTokens: vi.fn<typeof cleanupTokens>(),
  fetchMcpInfo: vi.fn<typeof fetchMcpInfo>(),
}))

vi.mock('@/toast/toastManager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/toast/toastManager')>()),
  notifySuccess: vi.fn<typeof notifySuccess>(),
  notifyError: vi.fn<typeof notifyError>(),
}))

const SECRET = 'sieb_c2VjcmV0LXNlY3JldC1zZWNyZXQtc2VjcmV0LXNlY3I'
const MCP_URL = 'https://sieb.example.com/mcp'

/**
 * Builds a live read token, expiring in 30 days.
 * @param {Partial<ApiTokenView>} overrides - Fields to set
 * @returns {ApiTokenView} - Token
 */
const token = (overrides: Partial<ApiTokenView> = {}): ApiTokenView => ({
  id: 1,
  name: 'laptop',
  scope: 'read',
  prefix: 'sieb_abcd1234',
  createdAt: '2026-11-01T10:00:00.000Z',
  expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  lastUsedAt: null,
  revokedAt: null,
  ...overrides,
})

const open = ref(false)
let mcpInfo: McpInfoResponse = { enabled: true, mcpUrl: MCP_URL, oauth: true, claude: null }
let wrapper: VueWrapper | null = null

const Host = defineComponent({
  setup: () => () =>
    h(ApiTokensDialog, {
      open: open.value,
      'onUpdate:open': (value: boolean) => {
        open.value = value
      },
    }),
})

/**
 * Mounts the dialog and opens it.
 * @returns {Promise<void>}
 */
const openDialog = async (): Promise<void> => {
  wrapper = mountWithProviders(Host, {})
  useMcpStore().info = mcpInfo
  open.value = true
  await flushPromises()
}

/**
 * Returns the open dialog element, rendered into the body portal.
 * @returns {HTMLElement} - Dialog
 */
const dialog = (): HTMLElement => document.body.querySelector<HTMLElement>('[role="dialog"]')!

/**
 * Returns a button of the page by its text or accessible name.
 * @param {string} name - Text or aria-label
 * @returns {HTMLButtonElement | undefined} - Button
 */
const button = (name: string): HTMLButtonElement | undefined =>
  [...document.body.querySelectorAll('button')].find(
    (candidate) =>
      candidate.getAttribute('aria-label') === name || candidate.textContent?.trim() === name,
  )

/**
 * Types a name and submits the create form.
 * @param {string} name - Token name
 * @returns {Promise<void>}
 */
const submitName = async (name: string): Promise<void> => {
  const input = dialog().querySelector<HTMLInputElement>('input[type="text"]')!

  input.value = name
  input.dispatchEvent(new Event('input'))
  dialog().querySelector('form')!.dispatchEvent(new Event('submit'))
  await flushPromises()
}

beforeEach(() => {
  vi.mocked(fetchTokens).mockReset().mockResolvedValue([])
  mcpInfo = { enabled: true, mcpUrl: MCP_URL, oauth: true, claude: null }
  vi.mocked(createToken).mockReset()
  vi.mocked(revokeToken).mockReset()
  vi.mocked(deleteToken).mockReset().mockResolvedValue(undefined)
  vi.mocked(cleanupTokens).mockReset()
  vi.mocked(fetchMcpInfo)
    .mockReset()
    .mockImplementation(() => Promise.resolve(mcpInfo))
  vi.mocked(notifySuccess).mockClear()
  vi.mocked(notifyError).mockClear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  open.value = false
  document.body.innerHTML = ''
})

describe('ApiTokensDialog', () => {
  it('lists live tokens first and revoked ones muted without a revoke button', async () => {
    vi.mocked(fetchTokens).mockResolvedValue([
      token({ id: 3, name: 'old', revokedAt: '2026-11-20T10:00:00.000Z' }),
      token({ id: 2, name: 'ci', lastUsedAt: '2026-11-25T10:00:00.000Z' }),
    ])
    await openDialog()

    const rows = [...dialog().querySelectorAll<HTMLElement>('[data-token-id]')]

    expect(rows.map((row) => row.dataset.tokenId)).toEqual(['2', '3'])
    expect(rows[0]!.textContent).toContain('Read')
    expect(rows[0]!.textContent).toContain('sieb_abcd1234…')
    expect(rows[0]!.textContent).toContain('Expires')
    expect(rows[0]!.textContent).not.toContain('Expiresnever')
    expect(rows[1]!.classList).toContain('inactive')
    expect(rows[1]!.textContent).toContain('Revoked')
    expect(rows[1]!.textContent).toContain('never used')
    expect(button('Revoke ci')).toBeDefined()
    expect(button('Revoke old')).toBeUndefined()
    expect(document.activeElement).toBe(dialog().querySelector('input[type="text"]'))
  })

  it('shows the secret once with the setup snippets and drops it after closing', async () => {
    vi.mocked(createToken).mockResolvedValue({
      token: token({ id: 5, name: 'mac' }),
      secret: SECRET,
    })
    await openDialog()
    await submitName('  mac ')

    expect(createToken).toHaveBeenCalledWith({
      name: 'mac',
      scope: 'read',
      expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    })

    const expiresAt = Date.parse(vi.mocked(createToken).mock.calls[0]![0].expiresAt)

    expect(Math.round((expiresAt - Date.now()) / 86_400_000)).toBe(90)
    expect(dialog().textContent).toContain('sign in with your identity provider')
    expect(dialog().textContent).not.toContain('authentik')

    const secretBlock = dialog().querySelector<HTMLElement>('.new-token-secret')!

    expect(document.activeElement).toBe(secretBlock)
    expect(secretBlock.querySelector('.secret')!.textContent).toBe(SECRET)
    expect(secretBlock.textContent).toContain(
      `claude mcp add --transport http --scope user sieb ${MCP_URL} --header "Authorization: Bearer ${SECRET}"`,
    )
    expect(secretBlock.textContent).toContain('only this once')
    expect(secretBlock.textContent).toContain('~/.claude.json')
    expect(secretBlock.textContent).toContain('Add as custom connector in claude.ai')
    expect(dialog().querySelector('[data-token-id="5"]')).not.toBeNull()

    open.value = false
    await flushPromises()
    open.value = true
    await flushPromises()

    expect(document.body.textContent).not.toContain(SECRET)
    expect(dialog().querySelector('form')).not.toBeNull()
  })

  it('creates a read and propose token, labelled as proposals only', async () => {
    vi.mocked(createToken).mockResolvedValue({ token: token({ scope: 'propose' }), secret: SECRET })
    await openDialog()

    const propose = [...dialog().querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
      (radio) => radio.textContent?.trim() === 'Read and propose',
    )!

    expect(propose.disabled).toBe(false)
    expect(dialog().textContent).toContain('Propose lets Claude create proposals only')
    expect(dialog().textContent).toContain('nothing is muted before that')

    propose.click()
    await flushPromises()
    await submitName('laptop')

    expect(createToken).toHaveBeenCalledWith(expect.objectContaining({ scope: 'propose' }))
  })

  it('refreshes the Claude connection after revoking and creating a token', async () => {
    vi.mocked(fetchTokens).mockResolvedValue([token({ id: 2, name: 'ci' })])
    vi.mocked(revokeToken).mockResolvedValue(
      token({ id: 2, name: 'ci', revokedAt: '2026-11-26T10:00:00.000Z' }),
    )
    vi.mocked(createToken).mockResolvedValue({ token: token({ id: 5 }), secret: SECRET })
    mcpInfo = { ...mcpInfo, claude: { connected: true, activeTokens: 1, oauthLastSeenAt: null } }
    await openDialog()
    const mcp = useMcpStore()

    expect(mcp.connected).toBe(true)

    mcpInfo = { ...mcpInfo, claude: { connected: false, activeTokens: 0, oauthLastSeenAt: null } }
    button('Revoke ci')!.click()
    await flushPromises()
    ;[
      ...document.body
        .querySelector<HTMLElement>('[role="alertdialog"]')!
        .querySelectorAll('button'),
    ]
      .find((candidate) => candidate.textContent?.trim() === 'Revoke')!
      .click()
    await flushPromises()

    expect(fetchMcpInfo).toHaveBeenCalledOnce()
    expect(mcp.connected).toBe(false)

    mcpInfo = { ...mcpInfo, claude: { connected: true, activeTokens: 1, oauthLastSeenAt: null } }
    await submitName('laptop')

    expect(fetchMcpInfo).toHaveBeenCalledTimes(2)
    expect(mcp.connected).toBe(true)
    expect(mcp.connectReason).toBeNull()
  })

  it('offers only expiring tokens of 30, 90 or 365 days', async () => {
    await openDialog()

    expect(dialog().textContent).toContain('30 days')
    expect(dialog().textContent).toContain('90 days')
    expect(dialog().textContent).toContain('1 year')
    expect(dialog().textContent).not.toMatch(/Never/)
  })

  it('returns to the form when the secret is dismissed and hides the connector without OAuth', async () => {
    mcpInfo = { enabled: true, mcpUrl: MCP_URL, oauth: false, claude: null }
    vi.mocked(createToken).mockResolvedValue({ token: token(), secret: SECRET })
    await openDialog()
    await submitName('laptop')

    expect(dialog().textContent).not.toContain('claude.ai')

    button('Done')!.click()
    await flushPromises()

    expect(document.body.textContent).not.toContain(SECRET)
    expect(document.activeElement).toBe(dialog().querySelector('input[type="text"]'))
  })

  it('keeps the secret on Esc and outside clicks and hides the close button until Done', async () => {
    vi.mocked(createToken).mockResolvedValue({ token: token(), secret: SECRET })
    await openDialog()

    expect(button('Close dialog')).toBeDefined()

    await submitName('laptop')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(button('Close dialog')).toBeUndefined()

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    document.body
      .querySelector('.overlay')!
      .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
    await flushPromises()

    expect(open.value).toBe(true)
    expect(dialog().querySelector('.secret')!.textContent).toBe(SECRET)

    button('Done')!.click()
    await flushPromises()

    expect(button('Close dialog')).toBeDefined()

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await flushPromises()

    expect(open.value).toBe(false)
  })

  it('revokes a token after confirmation and focuses its row', async () => {
    vi.mocked(fetchTokens).mockResolvedValue([token({ id: 2, name: 'ci' })])
    vi.mocked(revokeToken).mockResolvedValue(
      token({ id: 2, name: 'ci', revokedAt: '2026-11-26T10:00:00.000Z' }),
    )
    await openDialog()

    button('Revoke ci')!.click()
    await flushPromises()

    const confirm = document.body.querySelector<HTMLElement>('[role="alertdialog"]')!

    expect(confirm.textContent).toContain('“ci”')
    expect(revokeToken).not.toHaveBeenCalled()

    ;[...confirm.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Revoke')!
      .click()
    await flushPromises()
    await nextTick()

    expect(revokeToken).toHaveBeenCalledWith(2)
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()

    const row = dialog().querySelector<HTMLElement>('[data-token-id="2"]')!

    expect(row.textContent).toContain('Revoked')
    expect(button('Revoke ci')).toBeUndefined()
    await vi.waitFor(() => expect(document.activeElement).toBe(row))
  })

  it('shows the name check, field errors and general errors of the server', async () => {
    await openDialog()
    await submitName('   ')

    expect(createToken).not.toHaveBeenCalled()
    expect(dialog().textContent).toContain('A name is required.')

    vi.mocked(createToken).mockRejectedValueOnce(
      new ApiError(
        400,
        { error: 'validation', errors: [{ field: 'name', code: 'too_long' }] },
        '/api/tokens',
      ),
    )
    await submitName('x')

    expect(dialog().textContent).toContain('At most 64 characters.')
    expect(dialog().querySelector('input[type="text"]')!.getAttribute('aria-invalid')).toBe('true')

    vi.mocked(createToken).mockRejectedValueOnce(
      new ApiError(409, { error: 'too_many_tokens' }, '/api/tokens'),
    )
    await submitName('x')

    expect(dialog().querySelector('[role="alert"]')!.textContent).toContain(
      'At most 20 active tokens, revoke one first.',
    )
  })

  it('offers a retry when the list fails to load', async () => {
    vi.mocked(fetchTokens).mockRejectedValueOnce(new Error('offline'))
    await openDialog()

    expect(dialog().textContent).toContain('Could not load the tokens: offline')

    button('Retry')!.click()
    await flushPromises()

    expect(fetchTokens).toHaveBeenCalledTimes(2)
    expect(dialog().textContent).toContain('No tokens yet.')
  })
})

describe('ApiTokensDialog token deletion', () => {
  const LIVE = { id: 2, name: 'ci' }
  const REVOKED = { id: 3, name: 'old', revokedAt: '2026-11-20T10:00:00.000Z' }
  const EXPIRED = { id: 4, name: 'stale', expiresAt: '2026-11-01T00:00:00.000Z' }

  /**
   * Returns the rendered token ids in list order.
   * @returns {string[]} - Ids
   */
  const rowIds = (): string[] =>
    [...dialog().querySelectorAll<HTMLElement>('[data-token-id]')].map(
      (row) => row.dataset.tokenId ?? '',
    )

  beforeEach(() => {
    vi.mocked(fetchTokens).mockResolvedValue([token(EXPIRED), token(REVOKED), token(LIVE)])
  })

  it('offers delete only on revoked and expired rows, plus clear inactive with the count', async () => {
    await openDialog()

    expect(rowIds()).toEqual(['2', '4', '3'])
    expect(button('Delete ci')).toBeUndefined()
    expect(button('Delete old')).toBeDefined()
    expect(button('Delete stale')).toBeDefined()
    expect(button('Revoke old')).toBeUndefined()
    expect(button('Clear inactive (2)')).toBeDefined()
  })

  it('hides clear inactive while every token is live', async () => {
    vi.mocked(fetchTokens).mockResolvedValue([token(LIVE)])
    await openDialog()

    expect(button('Clear inactive (1)')).toBeUndefined()
    expect(dialog().textContent).not.toContain('Clear inactive')
  })

  it('deletes a row without confirmation, toasts and focuses the next delete button', async () => {
    await openDialog()

    button('Delete stale')!.click()
    await flushPromises()

    expect(deleteToken).toHaveBeenCalledWith(4)
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()
    expect(rowIds()).toEqual(['2', '3'])
    expect(notifySuccess).toHaveBeenCalledWith('Deleted: stale')
    expect(button('Clear inactive (1)')).toBeDefined()
    await vi.waitFor(() => expect(document.activeElement).toBe(button('Delete old')))

    button('Delete old')!.click()
    await flushPromises()

    expect(rowIds()).toEqual(['2'])
    expect(dialog().textContent).not.toContain('Clear inactive')
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(dialog().querySelector('[data-token-id="2"]')),
    )
  })

  it('focuses the list once the last token is deleted', async () => {
    vi.mocked(fetchTokens).mockResolvedValue([token(REVOKED)])
    await openDialog()

    button('Delete old')!.click()
    await flushPromises()

    expect(dialog().textContent).toContain('No tokens yet.')
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(dialog().querySelector('.token-list')),
    )
  })

  it('keeps the row and shows an error toast when the server refuses', async () => {
    const failure = new ApiError(409, { error: 'token_live' }, '/api/tokens/3')

    vi.mocked(deleteToken).mockRejectedValueOnce(failure)
    await openDialog()

    button('Delete old')!.click()
    await flushPromises()

    expect(notifyError).toHaveBeenCalledWith('Could not delete the token', failure)
    expect(notifySuccess).not.toHaveBeenCalled()
    expect(rowIds()).toEqual(['2', '4', '3'])
    expect(button('Delete old')!.disabled).toBe(false)
  })

  it('drops a row the server no longer knows', async () => {
    vi.mocked(deleteToken).mockRejectedValueOnce(
      new ApiError(404, { error: 'not_found' }, '/api/tokens/3'),
    )
    await openDialog()

    button('Delete old')!.click()
    await flushPromises()

    expect(notifyError).not.toHaveBeenCalled()
    expect(rowIds()).toEqual(['2', '4'])
  })

  it('clears all inactive tokens, reloads the list, toasts the count and focuses the last row', async () => {
    vi.mocked(cleanupTokens).mockResolvedValue({ deleted: 2 })
    await openDialog()
    vi.mocked(fetchTokens).mockResolvedValue([token(LIVE)])

    button('Clear inactive (2)')!.click()
    await flushPromises()

    expect(cleanupTokens).toHaveBeenCalledTimes(1)
    expect(deleteToken).not.toHaveBeenCalled()
    expect(fetchTokens).toHaveBeenCalledTimes(2)
    expect(rowIds()).toEqual(['2'])
    expect(notifySuccess).toHaveBeenCalledWith('Deleted 2 inactive tokens')
    expect(dialog().textContent).not.toContain('Clear inactive')
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(dialog().querySelector('[data-token-id="2"]')),
    )
  })
})
