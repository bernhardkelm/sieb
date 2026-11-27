// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { readCheckerConfig } from '#checker/checkerConfig.ts'

const ENV = {
  SIEB_WORKER_URL: 'http://sieb:3101/',
  SIEB_WORKER_SECRET: 'worker-secret',
  CLAUDE_CODE_OAUTH_TOKEN: 'oauth-token',
}
const LOCAL = 'l'.repeat(32)

describe('readFetcherLink through readCheckerConfig', () => {
  it('reads the loopback fetcher URL, the local secret and the shared directory', () => {
    const config = readCheckerConfig({
      ...ENV,
      SIEB_FETCHER_URL: 'http://127.0.0.1:3102/',
      SIEB_FETCHER_LOCAL_SECRET: LOCAL,
      SIEB_CHECKER_SHARED_DIR: '/mnt/shared',
    })

    expect(config.fetcher).toEqual({ url: 'http://127.0.0.1:3102', secret: LOCAL })
    expect(config.sharedDir).toBe('/mnt/shared')
  })

  it('stays in single-container mode without SIEB_FETCHER_URL', () => {
    expect(readCheckerConfig(ENV).fetcher).toBeNull()
  })

  it('refuses the fetcher secret of sieb in the checker container', () => {
    expect(() => readCheckerConfig({ ...ENV, SIEB_FETCHER_SECRET: 'x'.repeat(40) })).toThrow(
      'SIEB_FETCHER_SECRET belongs to the fetcher container, not to the checker',
    )
    expect(() => readCheckerConfig({ ...ENV, SIEB_FETCHER_SECRET_FILE: '/run/x' })).toThrow(
      'SIEB_FETCHER_SECRET_FILE belongs to the fetcher container, not to the checker',
    )
  })

  it('refuses a non-loopback URL, a missing or short local secret and a secret without URL', () => {
    for (const url of [
      'http://fetcher:3102',
      'https://127.0.0.1:3102',
      'http://127.0.0.1:3102/x',
    ]) {
      expect(() =>
        readCheckerConfig({ ...ENV, SIEB_FETCHER_URL: url, SIEB_FETCHER_LOCAL_SECRET: LOCAL }),
      ).toThrow('SIEB_FETCHER_URL must be http://127.0.0.1:<port>')
    }

    expect(() => readCheckerConfig({ ...ENV, SIEB_FETCHER_URL: 'http://127.0.0.1:3102' })).toThrow(
      'SIEB_FETCHER_LOCAL_SECRET is required with SIEB_FETCHER_URL',
    )
    expect(() =>
      readCheckerConfig({
        ...ENV,
        SIEB_FETCHER_URL: 'http://127.0.0.1:3102',
        SIEB_FETCHER_LOCAL_SECRET: 'short',
      }),
    ).toThrow('SIEB_FETCHER_LOCAL_SECRET must have at least 32 characters')
    expect(() => readCheckerConfig({ ...ENV, SIEB_FETCHER_LOCAL_SECRET: LOCAL })).toThrow(
      'SIEB_FETCHER_LOCAL_SECRET needs SIEB_FETCHER_URL',
    )
    expect(() =>
      readCheckerConfig({
        ...ENV,
        SIEB_FETCHER_URL: 'http://127.0.0.1:3102',
        SIEB_FETCHER_LOCAL_SECRET: LOCAL,
        SIEB_CHECKER_SHARED_DIR: '/work',
      }),
    ).toThrow('SIEB_CHECKER_SHARED_DIR must differ from SIEB_CHECKER_WORKDIR')
  })
})
