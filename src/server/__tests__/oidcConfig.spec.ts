// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { readConfig } from '#server/config.ts'

const CWD = '/srv/sieb'
const SECRET = 'very-secret-client-secret'
const OIDC_ENV = {
  SIEB_AUTH: 'oidc',
  SIEB_OIDC_ISSUER: 'https://auth.example.com/application/o/sieb/',
  SIEB_OIDC_CLIENT_ID: 'sieb',
  SIEB_OIDC_CLIENT_SECRET: SECRET,
  SIEB_PUBLIC_URL: 'https://sieb.example.com',
  SIEB_METRICS_PORT: '9100',
}

/**
 * Returns the message readConfig throws.
 * @param {Record<string, string | undefined>} env - Environment
 * @returns {string} - Error message, empty when it did not throw
 */
const failure = (env: Record<string, string | undefined>): string => {
  try {
    readConfig(env, CWD)
    return ''
  } catch (error) {
    return (error as Error).message
  }
}

describe('readConfig auth modes', () => {
  it('defaults to header mode with /metrics on the main port', () => {
    const config = readConfig({}, CWD)

    expect(config.authMode).toBe('header')
    expect(config.oidc).toBeNull()
    expect(config.metricsPort).toBeNull()
    expect(config.devUser).toBe('dev')
  })

  it('accepts an optional metrics port in header mode', () => {
    expect(readConfig({ SIEB_METRICS_PORT: '9100' }, CWD).metricsPort).toBe(9100)
    expect(readConfig({ SIEB_METRICS_PORT: ' ' }, CWD).metricsPort).toBeNull()
    expect(failure({ SIEB_METRICS_PORT: '0' })).toMatch(/SIEB_METRICS_PORT/)
    expect(failure({ SIEB_METRICS_PORT: '70000' })).toMatch(/SIEB_METRICS_PORT/)
    expect(failure({ SIEB_METRICS_PORT: '3100' })).toMatch(/differ from SIEB_PORT/)
  })

  it('reads the oidc settings with defaults and never uses the dev user', () => {
    const config = readConfig({ ...OIDC_ENV, SIEB_DEV_USER: 'alice' }, CWD)

    expect(config.authMode).toBe('oidc')
    expect(config.devUser).toBeNull()
    expect(config.metricsPort).toBe(9100)
    expect(config.oidc).toEqual({
      issuer: 'https://auth.example.com/application/o/sieb/',
      clientId: 'sieb',
      clientSecret: SECRET,
      requiredGroup: null,
      sessionHours: 12,
    })
    expect(
      readConfig(
        { ...OIDC_ENV, SIEB_OIDC_REQUIRED_GROUP: ' sieb-users ', SIEB_SESSION_HOURS: '168' },
        CWD,
      ).oidc,
    ).toMatchObject({ requiredGroup: 'sieb-users', sessionHours: 168 })
    expect(readConfig({ ...OIDC_ENV, SIEB_AUTH: ' OIDC ' }, CWD).authMode).toBe('oidc')
  })

  it('refuses unknown modes and incomplete or invalid oidc settings', () => {
    expect(failure({ SIEB_AUTH: 'none' })).toMatch(/SIEB_AUTH must be one of header, oidc/)

    for (const name of [
      'SIEB_OIDC_ISSUER',
      'SIEB_OIDC_CLIENT_ID',
      'SIEB_OIDC_CLIENT_SECRET',
      'SIEB_PUBLIC_URL',
      'SIEB_METRICS_PORT',
    ]) {
      expect(failure({ ...OIDC_ENV, [name]: ' ' })).toMatch(new RegExp(`${name} must be set`))
    }

    expect(failure({ ...OIDC_ENV, SIEB_SESSION_HOURS: '0' })).toMatch(/SIEB_SESSION_HOURS/)
    expect(failure({ ...OIDC_ENV, SIEB_SESSION_HOURS: '169' })).toMatch(/SIEB_SESSION_HOURS/)
    expect(failure({ ...OIDC_ENV, SIEB_SESSION_HOURS: '1.5' })).toMatch(/SIEB_SESSION_HOURS/)
    expect(failure({ ...OIDC_ENV, SIEB_OIDC_ISSUER: 'ftp://auth.example.com' })).toMatch(
      /SIEB_OIDC_ISSUER/,
    )
  })

  it('needs https issuer and public URL in production and allows http outside it', () => {
    const http = {
      ...OIDC_ENV,
      SIEB_OIDC_ISSUER: 'http://localhost:9000/application/o/sieb/',
      SIEB_PUBLIC_URL: 'http://localhost:5173',
    }

    expect(readConfig(http, CWD).oidc?.issuer).toBe('http://localhost:9000/application/o/sieb/')
    expect(failure({ ...http, NODE_ENV: 'production' })).toMatch(/must be an https URL/)
    expect(
      failure({
        ...OIDC_ENV,
        NODE_ENV: 'production',
        SIEB_OIDC_ISSUER: 'http://auth.example.com/',
      }),
    ).toMatch(/SIEB_OIDC_ISSUER must be an https URL/)
    expect(readConfig({ ...OIDC_ENV, NODE_ENV: 'production' }, CWD).authMode).toBe('oidc')
  })

  it('refuses the MCP OAuth client as the UI login client', () => {
    const mcp = {
      ...OIDC_ENV,
      SIEB_MCP_ENABLED: 'true',
      SIEB_OAUTH_ISSUER: 'https://auth.example.com/application/o/sieb-mcp/',
    }

    expect(failure({ ...mcp, SIEB_OAUTH_CLIENT_ID: 'sieb' })).toMatch(/separate clients/)
    expect(readConfig({ ...mcp, SIEB_OAUTH_CLIENT_ID: 'sieb-mcp' }, CWD).oauth?.clientId).toBe(
      'sieb-mcp',
    )
  })

  it('never puts the client secret into an error message', () => {
    const messages = [
      failure({ ...OIDC_ENV, SIEB_PUBLIC_URL: undefined }),
      failure({ ...OIDC_ENV, SIEB_METRICS_PORT: undefined }),
      failure({ ...OIDC_ENV, SIEB_OIDC_ISSUER: 'nope' }),
      failure({ ...OIDC_ENV, SIEB_SESSION_HOURS: 'x' }),
    ]

    expect(messages.every((message) => message !== '' && !message.includes(SECRET))).toBe(true)
  })
})
