// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { gitEnv } from '#checker/source/gitEnv.ts'

const BASE = { PATH: '/usr/bin', HOME: '/work/check-7/home', TMPDIR: '/work/check-7/tmp' }

/**
 * Collects the GIT_CONFIG_* pairs of an environment.
 * @param {Record<string, string>} env - git environment
 * @returns {Record<string, string>} - Settings by key
 */
const settings = (env: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Array.from({ length: Number(env.GIT_CONFIG_COUNT) }, (_, index) => [
      env[`GIT_CONFIG_KEY_${index}`],
      env[`GIT_CONFIG_VALUE_${index}`],
    ]),
  )

describe('gitEnv', () => {
  it('builds an environment without system or global config, prompts or other protocols', () => {
    const env = gitEnv(BASE, null)

    expect(env).toMatchObject({
      ...BASE,
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
    })
    expect(settings(env)).toMatchObject({
      'protocol.allow': 'never',
      'protocol.https.allow': 'always',
      'http.followRedirects': 'false',
      'credential.helper': '',
      'core.hooksPath': '/dev/null',
      'core.symlinks': 'false',
      'core.protectNTFS': 'true',
      'core.protectHFS': 'true',
      'transfer.fsckObjects': 'true',
      'fetch.fsckObjects': 'true',
      'http.sslVerify': 'true',
      'maintenance.auto': 'false',
      'submodule.recurse': 'false',
      'fetch.recurseSubmodules': 'false',
    })
    expect(JSON.stringify(env)).not.toContain('Authorization')
  })

  it('adds the login as an extra header of the one repository URL', () => {
    const env = gitEnv(BASE, {
      repoUrl: 'https://gitlab.example.com/acme/app.git',
      username: 'deploy',
      secret: 'token',
    })

    expect(settings(env)['http.https://gitlab.example.com/acme/app.git.extraHeader']).toBe(
      `Authorization: Basic ${Buffer.from('deploy:token').toString('base64')}`,
    )
    expect(Object.keys(env).filter((key) => !key.startsWith('GIT_CONFIG_'))).not.toContain(
      'GIT_ASKPASS',
    )
  })

  it('adds no Authorization header for an anonymous fetch', () => {
    const env = gitEnv(BASE, {
      repoUrl: 'https://github.com/example/app.git',
      username: null,
      secret: null,
    })

    expect(JSON.stringify(env)).not.toContain('Authorization')
    expect(JSON.stringify(env)).not.toContain('extraHeader')
    expect(settings(env)).toMatchObject({
      'protocol.allow': 'never',
      'http.followRedirects': 'false',
    })
  })
})
