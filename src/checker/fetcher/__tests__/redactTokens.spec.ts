// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { redactTokens } from '#checker/fetcher/redactTokens.ts'
import { createSecretList } from '#checker/fetcher/secretList.ts'

const JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl'

describe('redactTokens', () => {
  it('masks Authorization header values in header, config and JSON form', () => {
    expect(redactTokens(`> Authorization: Bearer ${JWT}`)).toBe('> Authorization: [redacted]')
    expect(redactTokens('authorization=Basic eC1hY2Nlc3M6c2VjcmV0')).toBe(
      'authorization=[redacted]',
    )
    expect(redactTokens(`{"Authorization":"Bearer ${JWT}","Accept":"*/*"}`)).toBe(
      '{"Authorization":"[redacted]","Accept":"*/*"}',
    )
    expect(redactTokens('Proxy-Authorization: Basic Zm9vOmJhcg==')).toBe(
      'Proxy-Authorization: [redacted]',
    )
  })

  it('masks Bearer and Basic credentials a registry issued outside a header', () => {
    expect(redactTokens(`GET /v2/acme/app/manifests/1.0 with bearer ${JWT} failed`)).toBe(
      'GET /v2/acme/app/manifests/1.0 with bearer [redacted] failed',
    )
    expect(redactTokens('using Basic Zm9vOmJhcg== for ghcr.io')).toBe(
      'using Basic [redacted] for ghcr.io',
    )
  })

  it('masks token fields, URL userinfo and token or signature query parameters', () => {
    expect(redactTokens(`{"token":"${JWT}","access_token":"${JWT}","expires_in":300}`)).toBe(
      '{"token":"[redacted]","access_token":"[redacted]","expires_in":300}',
    )
    expect(
      redactTokens("unable to access 'https://oauth2:glpat-abc@gitlab.example.com/x.git'"),
    ).toBe("unable to access 'https://[redacted]@gitlab.example.com/x.git'")
    expect(
      redactTokens(
        'GET https://blob.example.net/x?X-Amz-Credential=AKIA1%2F2&X-Amz-Signature=abc123&expires=9',
      ),
    ).toBe(
      'GET https://blob.example.net/x?X-Amz-Credential=[redacted]&X-Amz-Signature=[redacted]&expires=9',
    )
    expect(redactTokens('GET https://ghcr.io/token?scope=repository:a:pull&token=t0k3n')).toBe(
      'GET https://ghcr.io/token?scope=repository:a:pull&token=[redacted]',
    )
  })

  it('keeps ordinary error texts', () => {
    const texts = [
      'GET https://ghcr.io/v2/acme/app/manifests/1.0: UNAUTHORIZED: authentication required',
      'Basic authentication failed',
      'fatal: could not read Username for https://gitlab.example.com: terminal prompts disabled',
      'Bearer realm="https://ghcr.io/token",service="ghcr.io"',
      'authorization failed for registry.example.com',
    ]

    expect(texts.map(redactTokens)).toEqual(texts)
  })
})

describe('createSecretList', () => {
  it('masks the known logins and tokens it never saw', () => {
    const secrets = createSecretList()

    secrets.add('deploy', 'glpat-0123456789')

    expect(
      secrets.redact(
        `token glpat-0123456789 as ${Buffer.from('deploy:glpat-0123456789').toString('base64')}, ` +
          `then Authorization: Bearer ${JWT}`,
      ),
    ).toBe('token [redacted] as [redacted], then Authorization: [redacted]')
  })
})
