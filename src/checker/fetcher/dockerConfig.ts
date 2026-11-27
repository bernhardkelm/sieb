import { chmod, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { normalizeHost, type RegistryAuth } from '#core/privateAccess.ts'
import { basicAuth } from '#checker/fetcher/basicAuth.ts'

// go-containerregistry looks up Docker Hub under the key of the docker CLI
const DOCKER_HUB_KEY = 'https://index.docker.io/v1/'

/**
 * Writes the docker config crane reads through DOCKER_CONFIG: a private directory (mode 700)
 * with config.json (mode 600). Without logins it stays empty, so crane pulls anonymously and
 * never falls back to a config of its own.
 * @param {string} dir - DOCKER_CONFIG directory in the fetcher's private work directory
 * @param {RegistryAuth[]} registries - Logins of the check
 * @returns {Promise<void>}
 */
export const writeDockerConfig = async (dir: string, registries: RegistryAuth[]): Promise<void> => {
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await chmod(dir, 0o700)

  const auths = Object.fromEntries(
    registries.map(({ host, username, secret }) => {
      const key = normalizeHost(host) === 'docker.io' ? DOCKER_HUB_KEY : normalizeHost(host)

      return [key, { auth: basicAuth(username, secret) }]
    }),
  )
  const file = join(dir, 'config.json')

  await writeFile(file, JSON.stringify({ auths }), { mode: 0o600 })
  await chmod(file, 0o600)
}

/**
 * Removes the docker config, called right after the pulls so syft and git never see it.
 * @param {string} dir - DOCKER_CONFIG directory
 * @returns {Promise<void>}
 */
export const removeDockerConfig = async (dir: string): Promise<void> => {
  await rm(dir, { recursive: true, force: true })
}
