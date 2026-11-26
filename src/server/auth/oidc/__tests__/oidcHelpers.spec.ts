// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createLoginTxSeal, LOGIN_TX_TTL_MS } from '#server/auth/oidc/loginTxSeal.ts'
import { escapeHtml } from '#server/auth/oidc/authPages.ts'
import { authCookiesFor } from '#server/auth/oidc/authCookies.ts'
import { safeReturnPath } from '#server/auth/oidc/returnPath.ts'

const TX = { state: 's', nonce: 'n', codeVerifier: 'v', returnTo: '/' }

describe('safeReturnPath', () => {
  it.each([
    [undefined, '/'],
    ['', '/'],
    ['inbox', '/'],
    ['//evil.example', '/'],
    ['///evil.example', '/'],
    ['/\\evil.example', '/'],
    ['/inbox\\..\\x', '/'],
    ['https://evil.example', '/'],
    ['/\t/evil.example', '/'],
    ['/\n/evil.example', '/'],
    ['/inbox\r\nSet-Cookie: x=1', '/'],
    ['/auth', '/'],
    ['/auth/login?return=/x', '/'],
    ['/%2e%2e/auth/logout', '/'],
    ['/.//evil.example', '/'],
    ['/%2e//evil.example', '/'],
    ['/a b', '/'],
    ['/\u65e5\u672c', '/'],
    [`/${'a'.repeat(2048)}`, '/'],
    ['/', '/'],
    ['/inbox?finding=1#top', '/inbox?finding=1#top'],
    ['/%2F%2Fevil.example', '/%2F%2Fevil.example'],
    ['/authors', '/authors'],
  ])('maps %j to %j', (raw, expected) => {
    expect(safeReturnPath(raw)).toBe(expected)
  })
})

describe('createLoginTxSeal', () => {
  it('opens what it sealed within the lifetime and nothing else', async () => {
    const now = { ms: Date.parse('2026-06-01T12:00:00.000Z') }
    const clock = (): Date => new Date(now.ms)
    const seal = createLoginTxSeal({ clock })
    const sealed = await seal.seal(TX)
    const [header] = sealed.split('.')

    expect(sealed.split('.')).toHaveLength(5)
    expect(JSON.parse(Buffer.from(header ?? '', 'base64url').toString())).toEqual({
      alg: 'dir',
      enc: 'A256GCM',
    })
    expect(sealed).not.toContain('codeVerifier')
    expect((await seal.open(sealed))?.expiresAtMs).toBe(now.ms + LOGIN_TX_TTL_MS)
    expect(await seal.open(sealed)).toMatchObject(TX)
    expect(await seal.open(sealed)).toMatchObject(TX)
    expect(await createLoginTxSeal({ clock }).open(sealed)).toBeNull()
    expect(await seal.open(`${sealed}x`)).toBeNull()
    expect(await seal.open('garbage')).toBeNull()
    now.ms += LOGIN_TX_TTL_MS - 1000
    expect(await seal.open(sealed)).toMatchObject(TX)
    now.ms += 1000
    expect(await seal.open(sealed)).toBeNull()
  })
})

describe('authCookiesFor', () => {
  it('uses the __Host- cookie over https only', () => {
    expect(authCookiesFor('https://sieb.example')).toEqual({
      secure: true,
      sessionName: '__Host-sieb_session',
      loginTxName: '__Host-sieb_login',
      signedOutName: '__Host-sieb_signedout',
    })
    expect(authCookiesFor('http://localhost:5173')).toEqual({
      secure: false,
      sessionName: 'sieb_session',
      loginTxName: 'sieb_login',
      signedOutName: 'sieb_signedout',
    })
  })
})

describe('escapeHtml', () => {
  it('escapes markup and quotes', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    )
  })
})
