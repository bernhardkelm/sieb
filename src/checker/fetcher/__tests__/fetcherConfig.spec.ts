// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { readFetcherConfig } from '#checker/fetcher/fetcherConfig.ts'

const ENV = {
  SIEB_WORKER_URL: 'http://sieb:3101/',
  SIEB_FETCHER_SECRET: 'f'.repeat(40),
  SIEB_FETCHER_LOCAL_SECRET: 'l'.repeat(32),
  PATH: '/usr/bin',
}

describe('readFetcherConfig', () => {
  it('applies the defaults', () => {
    expect(readFetcherConfig(ENV)).toEqual({
      workerUrl: 'http://sieb:3101',
      fetcherSecret: 'f'.repeat(40),
      localSecret: 'l'.repeat(32),
      port: 3102,
      workdir: '/work',
      sharedDir: '/shared',
      path: '/usr/bin',
      platform: 'linux/amd64',
      imageMaxBytes: 4 * 1024 ** 3,
      sourceMaxBytes: 512 * 1024 ** 2,
    })
  })

  it('reads the optional settings', () => {
    expect(
      readFetcherConfig({
        ...ENV,
        SIEB_FETCHER_PORT: '4000',
        SIEB_CHECKER_SOURCE_MAX_BYTES: '1048576',
        SIEB_CHECKER_SHARED_DIR: '/mnt/shared',
      }),
    ).toMatchObject({ port: 4000, sourceMaxBytes: 1048576, sharedDir: '/mnt/shared' })
  })

  it('refuses to start without its secrets or with invalid values', () => {
    expect(() => readFetcherConfig({})).toThrow('SIEB_WORKER_URL is required')
    expect(() => readFetcherConfig({ ...ENV, SIEB_FETCHER_SECRET: '' })).toThrow(
      'SIEB_FETCHER_SECRET is required',
    )
    expect(() => readFetcherConfig({ ...ENV, SIEB_FETCHER_LOCAL_SECRET: '' })).toThrow(
      'SIEB_FETCHER_LOCAL_SECRET is required',
    )
    expect(() => readFetcherConfig({ ...ENV, SIEB_FETCHER_PORT: '70000' })).toThrow(
      'SIEB_FETCHER_PORT must be an integer from 1 to 65535',
    )
    expect(() => readFetcherConfig({ ...ENV, SIEB_CHECKER_SHARED_DIR: '/work' })).toThrow(
      'SIEB_CHECKER_SHARED_DIR must differ from SIEB_CHECKER_WORKDIR',
    )
  })

  it('refuses the secrets of the checker, also as files', () => {
    for (const name of [
      'SIEB_WORKER_SECRET',
      'ANTHROPIC_API_KEY_FILE',
      'CLAUDE_CODE_OAUTH_TOKEN',
      'ANTHROPIC_AUTH_TOKEN',
    ]) {
      expect(() => readFetcherConfig({ ...ENV, [name]: 'secret-value' })).toThrow(
        `${name} belongs to the checker container`,
      )
    }
  })
})
