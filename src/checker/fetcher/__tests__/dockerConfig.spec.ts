// @vitest-environment node
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { removeDockerConfig, writeDockerConfig } from '#checker/fetcher/dockerConfig.ts'

describe('writeDockerConfig', () => {
  it('writes private auths under the keys crane looks up and removes them again', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sieb-docker-'))
    const dir = join(root, 'docker')

    await writeDockerConfig(dir, [
      { host: 'index.docker.io', username: 'me', secret: 'dckr_pat' },
      { host: 'Registry.GitLab.com', username: 'deploy', secret: 'gldt' },
    ])

    const auths = JSON.parse(await readFile(join(dir, 'config.json'), 'utf8')).auths

    expect(auths).toEqual({
      'https://index.docker.io/v1/': { auth: Buffer.from('me:dckr_pat').toString('base64') },
      'registry.gitlab.com': { auth: Buffer.from('deploy:gldt').toString('base64') },
    })
    expect((await stat(dir)).mode & 0o777).toBe(0o700)
    expect((await stat(join(dir, 'config.json'))).mode & 0o777).toBe(0o600)
    await removeDockerConfig(dir)
    await expect(stat(dir)).rejects.toThrow('ENOENT')
    await rm(root, { recursive: true, force: true })
  })
})
