// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { OAuthConfig } from '#server/mcpConfigValues.ts'
import type { OidcConfig } from '#server/oidcConfigValues.ts'
import { startupWarnings } from '#server/startupWarnings.ts'

const OIDC: OidcConfig = {
  issuer: 'https://auth.example.com/application/o/sieb/',
  clientId: 'sieb',
  clientSecret: 'secret',
  requiredGroup: null,
  sessionHours: 12,
  displayName: 'SSO',
}
const OAUTH: OAuthConfig = {
  issuer: 'https://auth.example.com/application/o/sieb-mcp/',
  clientId: 'sieb-mcp',
  jwksUrl: null,
  requiredGroup: null,
  clientLabel: 'claude.ai',
}

describe('startupWarnings', () => {
  it('warns in production about logins without a required group', () => {
    expect(startupWarnings({ production: true, oidc: OIDC, oauth: OAUTH })).toEqual([
      '[sieb] SIEB_OIDC_REQUIRED_GROUP is unset, every user of the issuer can log in',
      '[sieb] SIEB_OAUTH_REQUIRED_GROUP is unset, every user of the issuer can use /mcp via OAuth',
    ])
  })

  it('stays quiet with groups set, without those logins and outside production', () => {
    const grouped = { production: true, oidc: { ...OIDC, requiredGroup: 'g' }, oauth: null }

    expect(startupWarnings(grouped)).toEqual([])
    expect(startupWarnings({ production: true, oidc: null, oauth: null })).toEqual([])
    expect(startupWarnings({ production: false, oidc: OIDC, oauth: OAUTH })).toEqual([])
  })
})
