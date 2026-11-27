import { PROVIDER_SPECS, type AccessProvider } from '#core/privateAccess.ts'

/** The credential a token realm would receive the login of */
export interface RealmCredential {
  provider: AccessProvider
  hosts: readonly string[] // registry and git host of the credential
}

/**
 * Returns the host that serves the registry API, registry-1.docker.io for Docker Hub.
 * @param {string} host - Normalised registry host
 * @returns {string} - API host
 */
export const registryApiHost = (host: string): string =>
  host === 'docker.io' ? 'registry-1.docker.io' : host

/**
 * Lists the auth hosts a provider's own registry uses besides the credential's hosts:
 * ghcr.io for GitHub, gitlab.com for registry.gitlab.com, auth.docker.io for Docker Hub. A
 * self-hosted GitLab has none, its realm must be one of its own hosts.
 * @param {AccessProvider} provider - Provider of the credential
 * @param {string} registryHost - Normalised registry host of the image
 * @returns {string[]} - Known auth hosts
 */
const providerAuthHosts = (provider: AccessProvider, registryHost: string): string[] => {
  if (provider === 'github') {
    return ['ghcr.io']
  }

  if (provider === 'dockerhub') {
    return ['auth.docker.io']
  }

  return registryHost === PROVIDER_SPECS.gitlab.registryHost ? ['gitlab.com'] : []
}

/**
 * Returns whether a token realm may receive the credential: https without userinfo on a host of
 * the credential, the registry's API host, or a known auth host of its provider.
 * @param {string} realm - Realm URL of the challenge
 * @param {string} registryHost - Normalised registry host
 * @param {RealmCredential} credential - Provider and hosts of the credential
 * @returns {boolean} - True when the realm is trusted
 */
export const isTrustedRealm = (
  realm: string,
  registryHost: string,
  credential: RealmCredential,
): boolean => {
  let url: URL

  try {
    url = new URL(realm)
  } catch {
    return false
  }

  const trusted = [
    ...credential.hosts,
    registryApiHost(registryHost),
    ...providerAuthHosts(credential.provider, registryHost),
  ]

  return (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    trusted.includes(url.host.toLowerCase())
  )
}
