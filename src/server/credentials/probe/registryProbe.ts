import type { CredentialLogin } from '#server/credentials/credentialLogin.ts'
import { parseChallenge } from '#server/credentials/probe/bearerChallenge.ts'
import {
  basicAuth,
  discardBody,
  errorReason,
  probeRequest,
  statusReason,
  type ProbeOptions,
  type ProbeOutcome,
} from '#server/credentials/probe/probeFetch.ts'
import {
  isTrustedRealm,
  registryApiHost,
  type RealmCredential,
} from '#server/credentials/probe/tokenRealm.ts'
import { readCappedText } from '#server/kev/readCappedText.ts'

/** One image a registry test resolves */
export interface RegistryTarget {
  imageRef: string // shown in failures
  host: string // normalised registry host, docker.io for Docker Hub
  path: string // repository path, library/<name> for official Docker Hub images
  reference: string // digest or tag
}

const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ')
const MAX_TOKEN_BODY_BYTES = 64 * 1024

/**
 * Fetches a pull token from the realm with basic auth, scoped to the target repository.
 * @param {ProbeOptions} options - Probe options
 * @param {{ realm: string; service: string | null }} challenge - Realm and service of the challenge
 * @param {string} path - Repository path
 * @param {CredentialLogin} auth - Username and secret
 * @returns {Promise<{ token: string } | { reason: string }>} - Token, or why there is none
 */
const fetchToken = async (
  options: ProbeOptions,
  { realm, service }: { realm: string; service: string | null },
  path: string,
  auth: CredentialLogin,
): Promise<{ token: string } | { reason: string }> => {
  const url = new URL(realm)

  if (service !== null) {
    url.searchParams.set('service', service)
  }

  url.searchParams.set('scope', `repository:${path}:pull`)

  const response = await probeRequest(options, url.href, {
    headers: { Authorization: basicAuth(auth.username, auth.secret) },
  })

  if (response.status !== 200) {
    await discardBody(response)
    return { reason: statusReason(response.status) }
  }

  const body = JSON.parse(await readCappedText(response, MAX_TOKEN_BODY_BYTES)) as {
    token?: unknown
    access_token?: unknown
  }
  const token = typeof body.token === 'string' ? body.token : body.access_token

  return typeof token === 'string' && token !== '' ? { token } : { reason: 'no token' }
}

/**
 * Resolves the manifest of one image with the credential: an anonymous HEAD first, then the
 * OCI distribution auth flow its 401 asks for, a Bearer token from the realm or Basic auth.
 * @param {ProbeOptions} options - Probe options
 * @param {RegistryTarget} target - Image to resolve
 * @param {CredentialLogin} auth - Username and secret
 * @param {RealmCredential} credential - Provider and hosts of the credential, which decide the trusted token realms
 * @returns {Promise<ProbeOutcome>} - null when the manifest resolved, else a short reason
 */
export const probeRegistry = async (
  options: ProbeOptions,
  target: RegistryTarget,
  auth: CredentialLogin,
  credential: RealmCredential,
): Promise<ProbeOutcome> => {
  const url = `https://${registryApiHost(target.host)}/v2/${target.path}/manifests/${target.reference}`

  try {
    const anonymous = await probeRequest(options, url, {
      method: 'HEAD',
      headers: { Accept: MANIFEST_ACCEPT },
    })

    await discardBody(anonymous)

    if (anonymous.status === 200) {
      return null
    }

    const challenge =
      anonymous.status === 401 ? parseChallenge(anonymous.headers.get('www-authenticate')) : null

    if (challenge === null) {
      return statusReason(anonymous.status)
    }

    let authorization = basicAuth(auth.username, auth.secret)

    if (challenge.scheme === 'bearer') {
      if (!isTrustedRealm(challenge.realm, target.host, credential)) {
        return 'token realm on another host'
      }

      const token = await fetchToken(options, challenge, target.path, auth)

      if ('reason' in token) {
        return token.reason
      }

      authorization = `Bearer ${token.token}`
    }

    const authed = await probeRequest(options, url, {
      method: 'HEAD',
      headers: { Accept: MANIFEST_ACCEPT, Authorization: authorization },
    })

    await discardBody(authed)
    return authed.status === 200 ? null : statusReason(authed.status)
  } catch (error) {
    return error instanceof SyntaxError ? 'invalid token answer' : errorReason(error)
  }
}
