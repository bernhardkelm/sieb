import type { PullProbeResult } from '#core/imageVisibility.ts'
import { parseChallenge } from '#server/credentials/probe/bearerChallenge.ts'
import {
  discardBody,
  errorReason,
  probeRequest,
  statusReason,
  type ProbeOptions,
} from '#server/credentials/probe/probeFetch.ts'
import type { RegistryTarget } from '#server/credentials/probe/registryProbe.ts'
import { registryApiHost } from '#server/credentials/probe/tokenRealm.ts'
import { readCappedText } from '#server/kev/readCappedText.ts'

/** Outcome of one anonymous pull probe */
export interface PullProbeOutcome {
  result: PullProbeResult
  reason: string | null // short reason for restricted and failed, null for public
}

const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ')
const MAX_TOKEN_BODY_BYTES = 64 * 1024
const DENIED = new Set([401, 403])

/**
 * Maps the status of the manifest or token request to an outcome: 200 public, 401 and 403
 * restricted, anything else a failure that says nothing about the image.
 * @param {number} status - HTTP status
 * @returns {PullProbeOutcome} - Outcome
 */
const outcomeOf = (status: number): PullProbeOutcome => {
  if (status === 200) {
    return { result: 'public', reason: null }
  }

  return { result: DENIED.has(status) ? 'restricted' : 'failed', reason: statusReason(status) }
}

/**
 * Fetches an anonymous pull token from the realm of a Bearer challenge, scoped to the repository.
 * No credential is ever sent, so any realm the vetted probe fetch reaches may answer.
 * @param {ProbeOptions} options - Probe options
 * @param {{ realm: string; service: string | null }} challenge - Realm and service
 * @param {string} path - Repository path
 * @returns {Promise<{ token: string } | PullProbeOutcome>} - Token, or the outcome without one
 */
const anonymousToken = async (
  options: ProbeOptions,
  { realm, service }: { realm: string; service: string | null },
  path: string,
): Promise<{ token: string } | PullProbeOutcome> => {
  const url = new URL(realm)

  if (service !== null) {
    url.searchParams.set('service', service)
  }

  url.searchParams.set('scope', `repository:${path}:pull`)

  const response = await probeRequest(options, url.href, {})

  if (response.status !== 200) {
    await discardBody(response)
    return outcomeOf(response.status)
  }

  const body = JSON.parse(await readCappedText(response, MAX_TOKEN_BODY_BYTES)) as {
    token?: unknown
    access_token?: unknown
  }
  const token = typeof body.token === 'string' ? body.token : body.access_token

  return typeof token === 'string' && token !== ''
    ? { token }
    : { result: 'failed', reason: 'no token' }
}

/**
 * Tells whether an image can be pulled without a login: HEAD on its manifest, and on a Bearer
 * challenge the same HEAD with an anonymous token of the realm. Nothing is downloaded and no
 * credential is sent; the probe fetch refuses private and in-cluster addresses.
 * @param {ProbeOptions} options - Vetted fetch, overall signal and request limit
 * @param {RegistryTarget} target - Registry host, repository path and reference
 * @returns {Promise<PullProbeOutcome>} - public, restricted or failed with a short reason
 */
export const probeAnonymousPull = async (
  options: ProbeOptions,
  target: RegistryTarget,
): Promise<PullProbeOutcome> => {
  const url = `https://${registryApiHost(target.host)}/v2/${target.path}/manifests/${target.reference}`

  try {
    const first = await probeRequest(options, url, {
      method: 'HEAD',
      headers: { Accept: MANIFEST_ACCEPT },
    })

    await discardBody(first)

    const challenge =
      first.status === 401 ? parseChallenge(first.headers.get('www-authenticate')) : null

    if (challenge?.scheme !== 'bearer') {
      return outcomeOf(first.status)
    }

    const token = await anonymousToken(options, challenge, target.path)

    if (!('token' in token)) {
      return token
    }

    const second = await probeRequest(options, url, {
      method: 'HEAD',
      headers: { Accept: MANIFEST_ACCEPT, Authorization: `Bearer ${token.token}` },
    })

    await discardBody(second)
    return outcomeOf(second.status)
  } catch (error) {
    return {
      result: 'failed',
      reason: error instanceof SyntaxError ? 'invalid token answer' : errorReason(error),
    }
  }
}
