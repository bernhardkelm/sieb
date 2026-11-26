import { createHash, randomBytes } from 'node:crypto'

import { Hono } from 'hono'
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose'
import type { CustomFetch } from 'openid-client'

export const IDP_ISSUER = 'https://idp.test/application/o/sieb/'
export const IDP_CLIENT_ID = 'sieb'
export const IDP_CLIENT_SECRET = 'not-a-real-secret'

/** Knobs a test turns on the fake provider between requests */
export interface FakeOidcProvider {
  fetch: CustomFetch
  claims: JWTPayload // merged into every ID token, undefined values drop a claim
  nonceOverride: string | null // replaces the nonce of the authorize request in the ID token
  endSession: boolean // whether discovery advertises an end_session_endpoint
  down: boolean // answers discovery with 500
  foreignKey: boolean // signs ID tokens with a key outside the published key set
  discoveries: number
}

interface PendingCode {
  nonce: string
  challenge: string
  redirectUri: string
}

const rsa = await generateKeyPair('RS256')
const foreign = await generateKeyPair('RS256')
const jwk = { ...(await exportJWK(rsa.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }

/**
 * Creates an in-process OIDC provider shaped like authentik: discovery, JWKS, an authorize
 * endpoint that redirects straight back with a code, and a token endpoint that checks the client
 * secret, the redirect URI and the PKCE S256 verifier and issues an RS256 ID token with the nonce.
 * @returns {FakeOidcProvider} - Provider, its fetch goes to openid-client as customFetch
 */
export const createFakeOidcProvider = (): FakeOidcProvider => {
  const codes = new Map<string, PendingCode>()
  const idp = new Hono()
  const base = new URL(IDP_ISSUER)
  const provider: FakeOidcProvider = {
    fetch: (url, options) => Promise.resolve(idp.fetch(new Request(url, options as RequestInit))),
    claims: { preferred_username: 'alice', groups: ['sieb-users'] },
    nonceOverride: null,
    endSession: true,
    down: false,
    foreignKey: false,
    discoveries: 0,
  }

  idp.get(`${base.pathname}.well-known/openid-configuration`, (c) => {
    provider.discoveries += 1
    if (provider.down) {
      return c.text('down', 500)
    }

    return c.json({
      issuer: IDP_ISSUER,
      authorization_endpoint: new URL('/application/o/authorize/', IDP_ISSUER).href,
      token_endpoint: new URL('/application/o/token/', IDP_ISSUER).href,
      jwks_uri: new URL('jwks/', IDP_ISSUER).href,
      ...(provider.endSession
        ? { end_session_endpoint: new URL('end-session/', IDP_ISSUER).href }
        : {}),
      id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['S256'],
    })
  })

  idp.get(`${base.pathname}jwks/`, (c) => c.json({ keys: [jwk] }))

  idp.get('/application/o/authorize/', (c) => {
    const query = c.req.query()

    if (query.client_id !== IDP_CLIENT_ID || query.code_challenge_method !== 'S256') {
      return c.text('bad authorize request', 400)
    }

    const code = randomBytes(16).toString('hex')
    const back = new URL(query.redirect_uri ?? '')

    codes.set(code, {
      nonce: query.nonce ?? '',
      challenge: query.code_challenge ?? '',
      redirectUri: back.href,
    })
    back.searchParams.set('code', code)
    back.searchParams.set('state', query.state ?? '')
    return c.redirect(back.href, 302)
  })

  idp.post('/application/o/token/', async (c) => {
    const form = await c.req.parseBody()
    const pending = codes.get(String(form.code))
    const challenge = createHash('sha256').update(String(form.code_verifier)).digest('base64url')

    codes.delete(String(form.code))
    if (form.client_id !== IDP_CLIENT_ID || form.client_secret !== IDP_CLIENT_SECRET) {
      return c.json({ error: 'invalid_client' }, 401)
    }

    if (
      form.grant_type !== 'authorization_code' ||
      pending === undefined ||
      pending.redirectUri !== form.redirect_uri ||
      pending.challenge !== challenge
    ) {
      return c.json({ error: 'invalid_grant' }, 400)
    }

    const idToken = await new SignJWT({
      sub: 'subject-1',
      nonce: provider.nonceOverride ?? pending.nonce,
      ...provider.claims,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(IDP_ISSUER)
      .setAudience(IDP_CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(provider.foreignKey ? foreign.privateKey : rsa.privateKey)

    return c.json({
      access_token: 'not-a-real-access-token',
      token_type: 'Bearer',
      expires_in: 300,
      id_token: idToken,
    })
  })

  return provider
}
