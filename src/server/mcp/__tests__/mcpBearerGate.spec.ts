// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { OAuthError, OAuthErrorCode, type OAuthTokenVerifier } from '@modelcontextprotocol/server'

import { createMcpBearerGate } from '#server/mcp/mcpBearerGate.ts'

const METADATA_URL = 'https://sieb.example.com/.well-known/oauth-protected-resource/mcp'
const SCOPES: Record<string, string[]> = {
  read: ['sieb:read'],
  propose: ['sieb:read', 'sieb:propose'],
  none: [],
}

const verifier: OAuthTokenVerifier = {
  verifyAccessToken: async (token) => {
    const scopes = SCOPES[token]

    if (scopes === undefined) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Unknown token')
    }

    return { token, clientId: 'test', scopes, expiresAt: Math.floor(Date.now() / 1000) + 60 }
  },
}

const gate = createMcpBearerGate({ verifier, resourceMetadataUrl: METADATA_URL })

/**
 * Runs the gate on a request with the given Authorization header.
 * @param {string | null} authorization - Header value, null sends none
 * @returns {Promise<unknown>} - AuthInfo or Response
 */
const check = (authorization: string | null): Promise<unknown> =>
  gate(
    new Request('https://sieb.example.com/mcp', {
      method: 'POST',
      headers: authorization === null ? {} : { Authorization: authorization },
    }),
  )

/**
 * Asserts a refusal and returns its status and challenge.
 * @param {unknown} result - Gate result
 * @returns {{ status: number; challenge: string | null }} - Status and WWW-Authenticate value
 */
const refusal = (result: unknown): { status: number; challenge: string | null } => {
  expect(result).toBeInstanceOf(Response)
  const response = result as Response

  return { status: response.status, challenge: response.headers.get('WWW-Authenticate') }
}

describe('createMcpBearerGate', () => {
  it('challenges a missing or unknown token with every MCP scope', async () => {
    for (const authorization of [null, 'Bearer unknown', 'Basic abc']) {
      expect(refusal(await check(authorization))).toEqual({
        status: 401,
        challenge: expect.stringMatching(
          new RegExp(
            `^Bearer error="invalid_token", error_description="[^"]+", ` +
              `scope="sieb:read sieb:propose", resource_metadata="${METADATA_URL}"$`,
          ),
        ),
      })
    }
  })

  it('refuses a token without sieb:read with 403 naming only sieb:read', async () => {
    const { status, challenge } = refusal(await check('Bearer none'))

    expect(status).toBe(403)
    expect(challenge).toMatch(/^Bearer error="insufficient_scope", /)
    expect(challenge).toContain('scope="sieb:read",')
    expect(challenge).not.toContain('sieb:propose')
  })

  it('accepts read-only and propose tokens with their own scopes', async () => {
    expect(await check('Bearer read')).toMatchObject({
      scopes: ['sieb:read'],
      resourceMetadataUrl: METADATA_URL,
    })
    expect(await check('Bearer propose')).toMatchObject({ scopes: ['sieb:read', 'sieb:propose'] })
  })
})
