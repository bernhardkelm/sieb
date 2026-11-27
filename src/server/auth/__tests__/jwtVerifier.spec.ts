// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { OAuthError } from '@modelcontextprotocol/server'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose'

import { createDiscoveredJwks, discoveryUrlOf } from '#server/auth/discoveredJwks.ts'
import { createJwtVerifier, grantsOf } from '#server/auth/jwtVerifier.ts'
import type { OAuthConfig } from '#server/mcpConfigValues.ts'

const NOW = new Date('2026-06-01T12:00:00.000Z')
const NOW_S = NOW.getTime() / 1000
const ISSUER = 'https://auth.example.com/application/o/sieb-mcp/'
const RESOURCE = new URL('https://sieb.example.com/mcp')
const OAUTH: OAuthConfig = {
  issuer: ISSUER,
  clientId: 'sieb-mcp',
  jwksUrl: null,
  requiredGroup: null,
  clientLabel: 'claude.ai',
}

const rsa = await generateKeyPair('RS256')
const jwks = createLocalJWKSet({
  keys: [{ ...(await exportJWK(rsa.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }],
})

/**
 * Signs an access token with the test key, claims merged over valid defaults.
 * @param {JWTPayload} claims - Claim overrides, undefined removes a claim
 * @returns {Promise<string>} - Compact JWT
 */
const sign = async (claims: JWTPayload = {}): Promise<string> => {
  const payload: JWTPayload = {
    iss: ISSUER,
    aud: 'sieb-mcp',
    exp: NOW_S + 300,
    iat: NOW_S,
    preferred_username: 'alice',
    groups: ['sieb-users'],
    scope: 'openid sieb:read',
    ...claims,
  }

  return new SignJWT(payload).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).sign(rsa.privateKey)
}

/**
 * Verifies a token with the test key set.
 * @param {string} token - Compact JWT
 * @param {Partial<OAuthConfig>} oauth - OAuth setting overrides
 * @returns {Promise<string | Awaited<ReturnType<ReturnType<typeof createJwtVerifier>>>>} - AuthInfo or the refusal as code and message
 */
const verify = async (
  token: string,
  oauth: Partial<OAuthConfig> = {},
): Promise<string | Awaited<ReturnType<ReturnType<typeof createJwtVerifier>>>> => {
  try {
    return await createJwtVerifier({
      oauth: { ...OAUTH, ...oauth },
      keys: jwks,
      clock: () => NOW,
      log: () => {},
    })(token, RESOURCE)
  } catch (error) {
    return error instanceof OAuthError ? `${error.code}: ${error.message}` : String(error)
  }
}

describe('jwtVerifier', () => {
  it('accepts a valid token as preferred_username with its sieb scopes', async () => {
    const token = await sign({ azp: 'sieb-mcp' })

    expect(await verify(token)).toEqual({
      token,
      clientId: 'sieb-mcp',
      scopes: ['sieb:read'],
      expiresAt: NOW_S + 300,
      resource: RESOURCE,
      extra: { actor: 'alice', via: 'oauth', tokenId: null, clientLabel: 'claude.ai', check: null },
    })
  })

  it('refuses a wrong issuer or audience and an expired token', async () => {
    expect(await verify(await sign({ iss: 'https://auth.example.com/other/' }))).toBe(
      'invalid_token: Invalid access token',
    )
    expect(await verify(await sign({ iss: ISSUER.slice(0, -1) }))).toMatch(/invalid_token/)
    expect(await verify(await sign({ aud: 'other-client' }))).toMatch(/invalid_token/)
    expect(await verify(await sign({ exp: NOW_S - 61 }))).toMatch(/invalid_token/)
    expect(await verify(await sign({ exp: NOW_S - 30 }))).not.toBeTypeOf('string')
    expect(await verify(await sign({ exp: undefined }))).toMatch(/invalid_token/)
  })

  it('refuses HS256 even with a matching secret key', async () => {
    const secret = new TextEncoder().encode('x'.repeat(32))
    const token = await new SignJWT({
      iss: ISSUER,
      aud: 'sieb-mcp',
      exp: NOW_S + 300,
      preferred_username: 'alice',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(secret)
    const verifier = createJwtVerifier({
      oauth: OAUTH,
      keys: async () => secret,
      clock: () => NOW,
      log: () => {},
    })

    await expect(verifier(token, RESOURCE)).rejects.toMatchObject({ code: 'invalid_token' })
  })

  it('refuses a token without a usable preferred_username', async () => {
    expect(await verify(await sign({ preferred_username: undefined }))).toBe(
      'invalid_token: Access token has no usable preferred_username',
    )

    for (const name of [' ', 'ali\nce', 'ali\u200bce', 'x'.repeat(257), 42]) {
      expect(await verify(await sign({ preferred_username: name }))).toMatch(/preferred_username/)
    }
  })

  it('refuses another or an additional audience and foreign token types, not a nonce', async () => {
    /**
     * Signs a token with a typ header.
     * @param {string} typ - typ header value
     * @returns {Promise<string>} - Compact JWT
     */
    const typed = (typ: string): Promise<string> =>
      new SignJWT({
        iss: ISSUER,
        aud: 'sieb-mcp',
        exp: NOW_S + 300,
        preferred_username: 'alice',
        scope: 'sieb:read',
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1', typ })
        .sign(rsa.privateKey)
    const refused = 'invalid_token: Invalid access token'

    expect(await verify(await sign({ aud: ['sieb-mcp'] }))).not.toBeTypeOf('string')
    expect(await verify(await sign({ aud: ['sieb-mcp', 'sieb'] }))).toBe(refused)
    expect(await verify(await sign({ aud: 'sieb' }))).toBe(refused)
    expect(await verify(await sign({ nonce: 'n' }))).not.toBeTypeOf('string')
    expect(await verify(await typed('at+jwt'))).not.toBeTypeOf('string')
    expect(await verify(await typed('JWT'))).not.toBeTypeOf('string')
    expect(await verify(await typed('logout+jwt'))).toBe(refused)
  })

  it('checks the required group when configured', async () => {
    expect(await verify(await sign(), { requiredGroup: 'sieb-users' })).not.toBeTypeOf('string')
    expect(await verify(await sign({ groups: ['other'] }), { requiredGroup: 'sieb-users' })).toBe(
      'insufficient_scope: Caller is not in the required group',
    )
    expect(
      await verify(await sign({ groups: undefined }), { requiredGroup: 'sieb-users' }),
    ).toMatch(/insufficient_scope/)
  })

  it('reads only the sieb scopes, propose implies read', () => {
    expect(grantsOf('openid sieb:propose')).toEqual(['sieb:read', 'sieb:propose'])
    expect(grantsOf('sieb:read profile')).toEqual(['sieb:read'])
    expect(grantsOf('openid sieb:admin')).toEqual([])
    expect(grantsOf(undefined)).toEqual([])
  })
})

describe('createDiscoveredJwks', () => {
  it('builds the discovery URL from the issuer', () => {
    expect(discoveryUrlOf(ISSUER).href).toBe(`${ISSUER}.well-known/openid-configuration`)
    expect(discoveryUrlOf('https://auth.example.com').href).toBe(
      'https://auth.example.com/.well-known/openid-configuration',
    )
  })

  it('refuses a discovery document of another issuer and retries 30 s after a failure', async () => {
    const documents = [
      { issuer: 'https://evil.example.com/', jwks_uri: 'https://evil.example.com/jwks' },
      { issuer: ISSUER, jwks_uri: 'http://auth.example.com/jwks' },
    ]
    const requested: string[] = []
    /**
     * Answers the next discovery document.
     * @param {URL | RequestInfo} url - Requested URL
     * @returns {Promise<Response>} - Discovery document
     */
    const fetchStub = async (url: URL | RequestInfo): Promise<Response> => {
      requested.push(String(url))
      return Response.json(documents.shift())
    }
    let now = 0
    const keys = createDiscoveredJwks(
      { issuer: ISSUER, jwksUrl: null },
      fetchStub as typeof fetch,
      () => now,
    )
    const header = { alg: 'RS256', kid: 'k1' }
    const input = { payload: '', signature: '' }

    await expect(keys(header, input)).rejects.toThrow('OpenID discovery names another issuer')
    now = 29_999
    await expect(keys(header, input)).rejects.toThrow('OpenID discovery names another issuer')
    now = 30_000
    await expect(keys(header, input)).rejects.toThrow('OpenID discovery has no usable jwks_uri')
    expect(requested).toEqual([discoveryUrlOf(ISSUER).href, discoveryUrlOf(ISSUER).href])
  })
})
