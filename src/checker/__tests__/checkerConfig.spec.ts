// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { readCheckerConfig } from '#checker/checkerConfig.ts'
import { DEFAULT_WEB_DOMAINS } from '#checker/config/webDomains.ts'

const ENV = {
  SIEB_WORKER_URL: 'http://sieb:3101/',
  SIEB_WORKER_SECRET: 'worker-secret',
  CLAUDE_CODE_OAUTH_TOKEN: 'oauth-token',
  PATH: '/usr/bin:/bin',
}

const FILES: Record<string, string> = {
  '/run/secrets/worker': 'file-secret\n',
  '/run/secrets/token': 'file-token\n',
  '/run/secrets/key': 'sk-ant-api03-file\n',
  '/run/secrets/two-lines': 'a\nb\n',
}

/**
 * Reads a fake mounted secret.
 * @param {string} path - File path
 * @returns {string} - Content
 * @throws {Error} - ENOENT for unknown paths
 */
const readFile = (path: string): string => {
  const content = FILES[path]

  if (content === undefined) {
    throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' })
  }

  return content
}

describe('readCheckerConfig', () => {
  it('applies the defaults', () => {
    expect(readCheckerConfig(ENV)).toEqual({
      workerUrl: 'http://sieb:3101',
      workerSecret: 'worker-secret',
      credential: { kind: 'oauth_token', value: 'oauth-token' },
      workdir: '/work',
      pollSeconds: 10,
      imageMaxBytes: 4 * 1024 ** 3,
      platform: 'linux/amd64',
      path: '/usr/bin:/bin',
      webDomains: DEFAULT_WEB_DOMAINS,
    })
  })

  it('reads the optional settings', () => {
    const config = readCheckerConfig({
      ...ENV,
      SIEB_CHECKER_WORKDIR: '/scratch',
      SIEB_CHECKER_POLL_SECONDS: '30',
      SIEB_CHECKER_IMAGE_MAX_BYTES: '1048576',
      SIEB_CHECKER_PLATFORM: 'linux/arm64/v8',
      SIEB_CHECKER_WEB_DOMAINS: 'NVD.nist.gov, *.example.org osv.dev,osv.dev',
    })

    expect(config).toMatchObject({
      workdir: '/scratch',
      pollSeconds: 30,
      imageMaxBytes: 1048576,
      platform: 'linux/arm64/v8',
      webDomains: ['nvd.nist.gov', '*.example.org', 'osv.dev'],
    })
  })

  it('lists the advisory, source, Go, distro and registry hosts by default', () => {
    expect(DEFAULT_WEB_DOMAINS).toEqual(
      expect.arrayContaining([
        'nvd.nist.gov',
        'www.cve.org',
        'www.cisa.gov',
        'osv.dev',
        'github.com',
        'raw.githubusercontent.com',
        'api.github.com',
        'pkg.go.dev',
        'vuln.go.dev',
        'security-tracker.debian.org',
        'ubuntu.com',
        'security.alpinelinux.org',
        'access.redhat.com',
        'registry.npmjs.org',
        'pypi.org',
        'crates.io',
        'rubygems.org',
        'repo1.maven.org',
        'hub.docker.com',
        'quay.io',
        'ghcr.io',
      ]),
    )
  })

  it('requires the URL, the worker secret and a Claude credential', () => {
    for (const name of ['SIEB_WORKER_URL', 'SIEB_WORKER_SECRET']) {
      expect(() => readCheckerConfig({ ...ENV, [name]: ' ' })).toThrow(`${name} is required`)
    }

    expect(() => readCheckerConfig({ ...ENV, CLAUDE_CODE_OAUTH_TOKEN: '' })).toThrow(
      'CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY is required',
    )
  })

  it('accepts an API key instead of the subscription token, never both', () => {
    const { CLAUDE_CODE_OAUTH_TOKEN: _token, ...withoutToken } = ENV

    expect(
      readCheckerConfig({ ...withoutToken, ANTHROPIC_API_KEY: 'sk-ant-x' }).credential,
    ).toEqual({ kind: 'api_key', value: 'sk-ant-x' })
    expect(() => readCheckerConfig({ ...ENV, ANTHROPIC_API_KEY: 'sk-ant-x' })).toThrow(
      'configure CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY, not both',
    )
    expect(() =>
      readCheckerConfig({ ...ENV, ANTHROPIC_API_KEY_FILE: '/run/secrets/key' }, readFile),
    ).toThrow('not both')
    expect(() => readCheckerConfig({ ...ENV, ANTHROPIC_AUTH_TOKEN: 'x' })).toThrow(
      'ANTHROPIC_AUTH_TOKEN is not supported',
    )
  })

  it('reads the secrets from mounted files', () => {
    const config = readCheckerConfig(
      {
        SIEB_WORKER_URL: 'http://sieb:3101',
        SIEB_WORKER_SECRET_FILE: '/run/secrets/worker',
        CLAUDE_CODE_OAUTH_TOKEN_FILE: '/run/secrets/token',
      },
      readFile,
    )

    expect(config.workerSecret).toBe('file-secret')
    expect(config.credential).toEqual({ kind: 'oauth_token', value: 'file-token' })
    expect(
      readCheckerConfig(
        {
          SIEB_WORKER_URL: 'http://sieb:3101',
          SIEB_WORKER_SECRET: 'worker-secret',
          ANTHROPIC_API_KEY_FILE: '/run/secrets/key',
        },
        readFile,
      ).credential,
    ).toEqual({ kind: 'api_key', value: 'sk-ant-api03-file' })
  })

  it('refuses a secret both as variable and as file, unreadable files and multi-line secrets', () => {
    expect(() =>
      readCheckerConfig({ ...ENV, SIEB_WORKER_SECRET_FILE: '/run/secrets/worker' }, readFile),
    ).toThrow('set SIEB_WORKER_SECRET or SIEB_WORKER_SECRET_FILE, not both')
    expect(() =>
      readCheckerConfig(
        { ...ENV, SIEB_WORKER_SECRET: '', SIEB_WORKER_SECRET_FILE: '/run/secrets/missing' },
        readFile,
      ),
    ).toThrow('SIEB_WORKER_SECRET_FILE cannot be read (ENOENT)')

    let message = ''

    try {
      readCheckerConfig(
        { ...ENV, SIEB_WORKER_SECRET: '', SIEB_WORKER_SECRET_FILE: '/run/secrets/two-lines' },
        readFile,
      )
    } catch (error) {
      message = (error as Error).message
    }

    expect(message).toBe(
      'SIEB_WORKER_SECRET_FILE must be one line of printable characters without spaces',
    )
  })

  it('rejects invalid values', () => {
    expect(() => readCheckerConfig({ ...ENV, SIEB_WORKER_URL: 'ftp://sieb' })).toThrow('http')
    expect(() => readCheckerConfig({ ...ENV, SIEB_CHECKER_POLL_SECONDS: '0' })).toThrow(
      'from 1 to 60',
    )
    expect(() => readCheckerConfig({ ...ENV, SIEB_CHECKER_POLL_SECONDS: '2147484' })).toThrow(
      'SIEB_CHECKER_POLL_SECONDS must be an integer from 1 to 60',
    )
    expect(() => readCheckerConfig({ ...ENV, SIEB_CHECKER_IMAGE_MAX_BYTES: '1.5' })).toThrow(
      'integer',
    )
    expect(() => readCheckerConfig({ ...ENV, SIEB_CHECKER_PLATFORM: 'amd64' })).toThrow('os/arch')
    expect(() => readCheckerConfig({ ...ENV, SIEB_CHECKER_WEB_DOMAINS: 'https://evil' })).toThrow(
      '"https://evil" is no host name',
    )
  })
})
