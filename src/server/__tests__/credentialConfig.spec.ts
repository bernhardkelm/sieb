// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readConfig } from '#server/config.ts'
import { readCredentialsKey } from '#server/credentialConfigValues.ts'

const CWD = '/srv/sieb'
const KEY = Buffer.alloc(32, 3)
const WORKER = 'w'.repeat(40)
const FETCHER = 'f'.repeat(40)
const CHECKS = {
  SIEB_CHECKS_ENABLED: 'true',
  SIEB_MCP_ENABLED: 'true',
  SIEB_PUBLIC_URL: 'http://localhost:5173',
  SIEB_WORKER_PORT: '9300',
  SIEB_WORKER_SECRET: WORKER,
}

/**
 * Writes a value to a fresh temporary file.
 * @param {string} content - File content
 * @returns {string} - Path
 */
const tempFile = (content: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), 'sieb-config-')), 'secret')

  writeFileSync(path, content)
  return path
}

describe('SIEB_CREDENTIALS_KEY', () => {
  it('is optional, a missing key turns private access off', () => {
    expect(readConfig({}, CWD).credentialsKey).toBeNull()
    expect(readCredentialsKey({ SIEB_CREDENTIALS_KEY: '  ' })).toBeNull()
  })

  it('reads 32 bytes in base64 or base64url, from the variable or a file', () => {
    expect(readCredentialsKey({ SIEB_CREDENTIALS_KEY: KEY.toString('base64') })).toEqual(KEY)
    expect(
      readCredentialsKey({ SIEB_CREDENTIALS_KEY: Buffer.alloc(32, 250).toString('base64url') }),
    ).toEqual(Buffer.alloc(32, 250))
    expect(
      readCredentialsKey({ SIEB_CREDENTIALS_KEY_FILE: tempFile(`${KEY.toString('base64')}\n`) }),
    ).toEqual(KEY)
  })

  it('refuses to start on a malformed key without echoing it', () => {
    const short = Buffer.alloc(16, 1).toString('base64')

    for (const value of [
      short,
      'not base64 at all',
      `${KEY.toString('base64')}AA`,
      KEY.toString('hex'),
    ]) {
      expect(() => readConfig({ SIEB_CREDENTIALS_KEY: value }, CWD)).toThrow(
        expect.objectContaining({ message: expect.not.stringContaining(value) }),
      )
    }

    expect(() => readCredentialsKey({ SIEB_CREDENTIALS_KEY: short })).toThrow(/32 bytes/)
  })

  it('refuses the variable together with its file and an unreadable file', () => {
    expect(() =>
      readCredentialsKey({
        SIEB_CREDENTIALS_KEY: KEY.toString('base64'),
        SIEB_CREDENTIALS_KEY_FILE: '/x',
      }),
    ).toThrow(/not both/)
    expect(() => readCredentialsKey({ SIEB_CREDENTIALS_KEY_FILE: '/nonexistent/key' })).toThrow(
      /ENOENT/,
    )
  })
})

describe('SIEB_FETCHER_SECRET', () => {
  it('is optional and only read with Auto-check on', () => {
    expect(readConfig(CHECKS, CWD).checks?.fetcherSecret).toBeNull()
    expect(readConfig({ SIEB_FETCHER_SECRET: 'short' }, CWD).checks).toBeNull()
  })

  it('reads the secret from the variable or a file', () => {
    expect(readConfig({ ...CHECKS, SIEB_FETCHER_SECRET: FETCHER }, CWD).checks?.fetcherSecret).toBe(
      FETCHER,
    )
    expect(
      readConfig({ ...CHECKS, SIEB_FETCHER_SECRET_FILE: tempFile(`${FETCHER}\n`) }, CWD).checks
        ?.fetcherSecret,
    ).toBe(FETCHER)
  })

  it('needs 32 characters without whitespace, distinct from the worker secret, never echoed', () => {
    const short = 'g'.repeat(31)

    expect(() => readConfig({ ...CHECKS, SIEB_FETCHER_SECRET: short }, CWD)).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(short) }),
    )
    expect(() => readConfig({ ...CHECKS, SIEB_FETCHER_SECRET: `${FETCHER} x` }, CWD)).toThrow(
      /whitespace/,
    )
    expect(() => readConfig({ ...CHECKS, SIEB_FETCHER_SECRET: WORKER }, CWD)).toThrow(/differ/)
  })
})
