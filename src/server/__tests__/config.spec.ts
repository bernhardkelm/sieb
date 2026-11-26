// @vitest-environment node
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DEFAULT_PORT, LIVE_DB_PATH, MOCK_DB_PATH, readConfig } from '#server/config.ts'

const CWD = '/srv/sieb'

describe('readConfig', () => {
  it('defaults to the kubectl source, the live database and the dev user', () => {
    const config = readConfig({}, CWD)

    expect(config.source).toBe('kubectl')
    expect(config.port).toBe(DEFAULT_PORT)
    expect(config.dbPath).toBe(resolve(CWD, LIVE_DB_PATH))
    expect(config.kubeContext).toBeNull()
    expect(config.prometheusService).toBe('monitoring/kube-prometheus-stack-prometheus:9090')
    expect(config.prometheusUrl).toBe('http://kube-prometheus-stack-prometheus.monitoring.svc:9090')
    expect(config.queries).toEqual({
      findings: 'sieb:trivy_finding:info',
      kev: 'sieb:kev:listed',
    })
    expect(config.syncIntervalMinutes).toBe(15)
    expect(config.devUser).toBe('dev')
    expect(config.userHeader).toBe('X-authentik-username')
    expect(config.staticDir).toBeNull()
  })

  it('reads the source settings', () => {
    const config = readConfig(
      {
        SIEB_KUBE_CONTEXT: ' prod ',
        SIEB_PROMETHEUS_SERVICE: 'observability/prometheus-operated:web',
        SIEB_PROMETHEUS_URL: 'https://prometheus.observability.svc:9091',
        SIEB_FINDINGS_QUERY: ' my:trivy_finding:info ',
        SIEB_KEV_QUERY: 'my:kev:listed',
        SIEB_DEV_USER: 'alice',
        SIEB_USER_HEADER: 'X-Forwarded-User',
      },
      CWD,
    )

    expect(config).toMatchObject({
      kubeContext: 'prod',
      prometheusService: 'observability/prometheus-operated:web',
      prometheusUrl: 'https://prometheus.observability.svc:9091',
      queries: { findings: 'my:trivy_finding:info', kev: 'my:kev:listed' },
      devUser: 'alice',
      userHeader: 'X-Forwarded-User',
    })
  })

  it('keeps the defaults for blank values', () => {
    const config = readConfig(
      { SIEB_KUBE_CONTEXT: ' ', SIEB_FINDINGS_QUERY: '', SIEB_KEV_QUERY: ' ', SIEB_DEV_USER: '' },
      CWD,
    )

    expect(config.kubeContext).toBeNull()
    expect(config.queries.findings).toBe('sieb:trivy_finding:info')
    expect(config.queries.kev).toBe('sieb:kev:listed')
    expect(config.devUser).toBe('dev')
  })

  it('uses the separate mock database in mock mode', () => {
    expect(readConfig({ SIEB_SOURCE: 'mock' }, CWD).dbPath).toBe(resolve(CWD, MOCK_DB_PATH))
  })

  it('refuses the live database in mock mode', () => {
    expect(() => readConfig({ SIEB_SOURCE: 'mock', SIEB_DB_PATH: LIVE_DB_PATH }, CWD)).toThrow(
      /must not use/,
    )
  })

  it('refuses mock mode in production and drops the dev user there', () => {
    expect(() => readConfig({ SIEB_SOURCE: 'mock', NODE_ENV: 'production' }, CWD)).toThrow(
      /NODE_ENV=production/,
    )
    expect(
      readConfig({ SIEB_SOURCE: 'incluster', NODE_ENV: 'production', SIEB_DEV_USER: 'x' }, CWD)
        .devUser,
    ).toBeNull()
  })

  it('treats the incluster source as production even without NODE_ENV', () => {
    const config = readConfig({ SIEB_SOURCE: 'incluster', SIEB_DEV_USER: 'x' }, CWD)

    expect(config.production).toBe(true)
    expect(config.devUser).toBeNull()
  })

  it('parses the allowed hosts', () => {
    expect(
      readConfig({ SIEB_ALLOWED_HOSTS: ' Sieb.example.com, ,10.0.0.5:3100' }, CWD).allowedHosts,
    ).toEqual(['sieb.example.com', '10.0.0.5:3100'])
    expect(readConfig({}, CWD).allowedHosts).toEqual([])
  })

  it('rejects invalid values', () => {
    expect(() => readConfig({ SIEB_SOURCE: 'nope' }, CWD)).toThrow(/SIEB_SOURCE/)
    expect(() => readConfig({ SIEB_PORT: '70000' }, CWD)).toThrow(/SIEB_PORT/)
    expect(() => readConfig({ SIEB_SYNC_INTERVAL_MINUTES: '0' }, CWD)).toThrow(
      /SIEB_SYNC_INTERVAL_MINUTES/,
    )
  })

  it.each([
    'kube-prometheus-stack-prometheus:9090',
    'monitoring/kube-prometheus-stack-prometheus',
    'monitoring/prometheus:9090/proxy',
    'Monitoring/prometheus:9090',
    'monitoring/../secrets:80',
  ])('rejects the Prometheus service %s', (value) => {
    expect(() => readConfig({ SIEB_PROMETHEUS_SERVICE: value }, CWD)).toThrow(
      /SIEB_PROMETHEUS_SERVICE must look like namespace\/name:port/,
    )
  })

  it('rejects an invalid Prometheus URL and user header', () => {
    expect(() => readConfig({ SIEB_PROMETHEUS_URL: 'prometheus:9090' }, CWD)).toThrow(
      /SIEB_PROMETHEUS_URL/,
    )
    expect(() => readConfig({ SIEB_PROMETHEUS_URL: 'ftp://prometheus' }, CWD)).toThrow(
      /SIEB_PROMETHEUS_URL/,
    )
    expect(() => readConfig({ SIEB_USER_HEADER: 'X User' }, CWD)).toThrow(/SIEB_USER_HEADER/)
  })

  it('defaults to the CISA KEV feed and reads the KEV source and URL', () => {
    expect(readConfig({}, CWD)).toMatchObject({
      kevSource: 'cisa',
      kevUrl: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    })
    expect(
      readConfig(
        { SIEB_KEV_SOURCE: ' prometheus ', SIEB_KEV_URL: 'http://mirror.example.com/kev.json' },
        CWD,
      ),
    ).toMatchObject({ kevSource: 'prometheus', kevUrl: 'http://mirror.example.com/kev.json' })
    expect(readConfig({ SIEB_KEV_SOURCE: 'none', SIEB_KEV_URL: ' ' }, CWD).kevSource).toBe('none')
  })

  it('rejects an unknown KEV source and a KEV URL that is not http or https', () => {
    expect(() => readConfig({ SIEB_KEV_SOURCE: 'nvd' }, CWD)).toThrow(
      'SIEB_KEV_SOURCE must be one of cisa, prometheus, none, got "nvd"',
    )
    expect(() => readConfig({ SIEB_KEV_SOURCE: 'CISA' }, CWD)).toThrow(/SIEB_KEV_SOURCE/)
    expect(() => readConfig({ SIEB_KEV_URL: 'file:///etc/kev.json' }, CWD)).toThrow(
      /SIEB_KEV_URL must be an http or https URL/,
    )
    expect(() => readConfig({ SIEB_KEV_URL: 'www.cisa.gov/kev.json' }, CWD)).toThrow(/SIEB_KEV_URL/)
  })

  it('leaves the MCP settings off by default', () => {
    expect(readConfig({}, CWD)).toMatchObject({
      mcpEnabled: false,
      publicUrl: null,
      mcpAllowedOrigins: [],
      oauth: null,
    })
  })

  it.each([
    ['true', true],
    [' TRUE ', true],
    ['1', true],
    ['false', false],
    ['0', false],
    ['', false],
  ])('reads SIEB_MCP_ENABLED=%j as %s', (value, expected) => {
    expect(readConfig({ SIEB_MCP_ENABLED: value }, CWD).mcpEnabled).toBe(expected)
  })

  it('rejects other SIEB_MCP_ENABLED values', () => {
    expect(() => readConfig({ SIEB_MCP_ENABLED: 'yes' }, CWD)).toThrow(
      'SIEB_MCP_ENABLED must be true, false, 1 or 0, got "yes"',
    )
  })

  it('ignores OAuth settings, even incomplete ones, while MCP is off', () => {
    expect(
      readConfig(
        { SIEB_OAUTH_ISSUER: 'not a url', SIEB_OAUTH_JWKS_URL: 'https://auth.example.com/' },
        CWD,
      ).oauth,
    ).toBeNull()
    expect(
      readConfig(
        {
          SIEB_PUBLIC_URL: 'https://sieb.example.com',
          SIEB_OAUTH_ISSUER: 'https://auth.example.com/',
          SIEB_OAUTH_CLIENT_ID: 'sieb-mcp',
        },
        CWD,
      ).oauth,
    ).toBeNull()
  })

  it('reads the public URL as a bare origin, https only in production', () => {
    expect(readConfig({ SIEB_PUBLIC_URL: ' http://localhost:5173 ' }, CWD).publicUrl).toBe(
      'http://localhost:5173',
    )
    expect(
      readConfig({ SIEB_SOURCE: 'incluster', SIEB_PUBLIC_URL: 'https://Sieb.example.com' }, CWD)
        .publicUrl,
    ).toBe('https://sieb.example.com')
    expect(() =>
      readConfig({ SIEB_SOURCE: 'incluster', SIEB_PUBLIC_URL: 'http://sieb.example.com' }, CWD),
    ).toThrow(/SIEB_PUBLIC_URL must be an https URL/)
    expect(() => readConfig({ SIEB_PUBLIC_URL: 'https://sieb.example.com/' }, CWD)).toThrow(
      /without path or trailing slash/,
    )
    expect(() => readConfig({ SIEB_PUBLIC_URL: 'https://sieb.example.com/sieb' }, CWD)).toThrow(
      /SIEB_PUBLIC_URL/,
    )
    expect(() => readConfig({ SIEB_PUBLIC_URL: 'sieb.example.com' }, CWD)).toThrow(
      /SIEB_PUBLIC_URL/,
    )
  })

  it('parses the allowed MCP origins', () => {
    expect(
      readConfig({ SIEB_MCP_ALLOWED_ORIGINS: ' https://Claude.ai, ,http://localhost:6274' }, CWD)
        .mcpAllowedOrigins,
    ).toEqual(['https://claude.ai', 'http://localhost:6274'])
    expect(() => readConfig({ SIEB_MCP_ALLOWED_ORIGINS: 'claude.ai' }, CWD)).toThrow(
      /SIEB_MCP_ALLOWED_ORIGINS/,
    )
    expect(() => readConfig({ SIEB_MCP_ALLOWED_ORIGINS: 'https://claude.ai/x' }, CWD)).toThrow(
      /SIEB_MCP_ALLOWED_ORIGINS/,
    )
  })

  it('reads the OAuth settings with the default client label', () => {
    const issuer = 'https://auth.example.com/application/o/sieb-mcp/'
    const env = {
      SIEB_MCP_ENABLED: 'true',
      SIEB_PUBLIC_URL: 'https://sieb.example.com',
      SIEB_OAUTH_ISSUER: issuer,
      SIEB_OAUTH_CLIENT_ID: ' sieb-mcp ',
    }

    expect(readConfig(env, CWD).oauth).toEqual({
      issuer,
      clientId: 'sieb-mcp',
      jwksUrl: null,
      requiredGroup: null,
      clientLabel: 'claude.ai',
    })
    expect(
      readConfig(
        {
          ...env,
          SIEB_OAUTH_JWKS_URL: 'https://auth.example.com/application/o/sieb-mcp/jwks/',
          SIEB_OAUTH_REQUIRED_GROUP: 'sieb-users',
          SIEB_OAUTH_CLIENT_LABEL: 'Claude',
        },
        CWD,
      ).oauth,
    ).toMatchObject({
      jwksUrl: 'https://auth.example.com/application/o/sieb-mcp/jwks/',
      requiredGroup: 'sieb-users',
      clientLabel: 'Claude',
    })
  })

  it('refuses incomplete or invalid OAuth settings', () => {
    const publicUrl = { SIEB_MCP_ENABLED: '1', SIEB_PUBLIC_URL: 'https://sieb.example.com' }

    expect(() =>
      readConfig({ ...publicUrl, SIEB_OAUTH_ISSUER: 'https://auth.example.com/' }, CWD),
    ).toThrow(/must be set together/)
    expect(() => readConfig({ ...publicUrl, SIEB_OAUTH_CLIENT_ID: 'sieb-mcp' }, CWD)).toThrow(
      /must be set together/,
    )
    expect(() =>
      readConfig(
        {
          SIEB_MCP_ENABLED: '1',
          SIEB_OAUTH_ISSUER: 'https://auth.example.com/',
          SIEB_OAUTH_CLIENT_ID: 'sieb-mcp',
        },
        CWD,
      ),
    ).toThrow(/needs SIEB_PUBLIC_URL/)
    expect(() =>
      readConfig(
        {
          SIEB_SOURCE: 'incluster',
          ...publicUrl,
          SIEB_OAUTH_ISSUER: 'http://auth.example.com/',
          SIEB_OAUTH_CLIENT_ID: 'sieb-mcp',
        },
        CWD,
      ),
    ).toThrow(/SIEB_OAUTH_ISSUER must be an https URL/)
    expect(() =>
      readConfig({ ...publicUrl, SIEB_OAUTH_JWKS_URL: 'https://auth.example.com/jwks/' }, CWD),
    ).toThrow(/SIEB_OAUTH_JWKS_URL needs/)
  })
})
