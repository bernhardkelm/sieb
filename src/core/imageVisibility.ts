import { registryScopeFor, type AccessScope } from '#core/accessScope.ts'
import { SELF_OWNER } from '#core/owner.ts'
import { registryOf } from '#core/registryHost.ts'

/** Whether an image can be pulled: anonymously, with a stored registry credential, not at all, or not known yet */
export const IMAGE_VISIBILITIES = ['public', 'credential', 'restricted', 'unknown'] as const

export type ImageVisibility = (typeof IMAGE_VISIBILITIES)[number]

/** Whose image it is: own (owner label self) or third_party */
export const IMAGE_OWNERSHIPS = ['own', 'third_party'] as const

export type ImageOwnership = (typeof IMAGE_OWNERSHIPS)[number]

/** Stored outcome of the anonymous pull probe of an image repository */
export const PULL_PROBE_RESULTS = ['public', 'restricted', 'failed'] as const

export type PullProbeResult = (typeof PULL_PROBE_RESULTS)[number]

/** The two access facts of an image, as API and MCP rows carry them */
export interface ImageAccess {
  imageVisibility: ImageVisibility
  ownership: ImageOwnership
}

/** What decides the access facts of images, read once per request */
export interface ImageAccessSources {
  probeOf: (imageRef: string) => PullProbeResult | null // last probe answer of an own image, null while never probed
  publicRegistries: readonly string[] // third-party images on these hosts count as public without a probe
  scopes: readonly AccessScope[] // usable credentials, empty while private access is off
}

/**
 * Returns whose image it is.
 * @param {string | null} owner - Owner label, null without one
 * @returns {ImageOwnership} - own for the self owner, else third_party
 */
export const ownershipOf = (owner: string | null): ImageOwnership =>
  owner === SELF_OWNER ? 'own' : 'third_party'

/**
 * Classifies whether an image can be pulled. Only own images are probed: an anonymous pull the
 * probe saw succeed wins, then a covering registry credential, then a refused anonymous pull,
 * else unknown. A third-party image counts as public on a listed public registry, else as
 * credential when a registry credential covers it, else unknown.
 * @param {{ imageRef: string; owner: string | null }} image - Image ref and owner label
 * @param {ImageAccessSources} sources - Probe results, public registries and credentials
 * @returns {ImageVisibility} - public, credential, restricted or unknown
 */
export const visibilityOf = (
  image: { imageRef: string; owner: string | null },
  sources: ImageAccessSources,
): ImageVisibility => {
  const covered = registryScopeFor(sources.scopes, image.imageRef) !== null

  if (ownershipOf(image.owner) === 'third_party') {
    const registry = registryOf(image.imageRef)

    if (registry !== null && sources.publicRegistries.includes(registry)) {
      return 'public'
    }

    return covered ? 'credential' : 'unknown'
  }

  const probe = sources.probeOf(image.imageRef)

  if (probe === 'public') {
    return 'public'
  }

  if (covered) {
    return 'credential'
  }

  return probe === 'restricted' ? 'restricted' : 'unknown'
}

/**
 * Returns both access facts of an image.
 * @param {{ imageRef: string; owner: string | null }} image - Image ref and owner label
 * @param {ImageAccessSources} sources - Probe results, public registries and credentials
 * @returns {ImageAccess} - Visibility and ownership
 */
export const imageAccessOf = (
  image: { imageRef: string; owner: string | null },
  sources: ImageAccessSources,
): ImageAccess => ({
  imageVisibility: visibilityOf(image, sources),
  ownership: ownershipOf(image.owner),
})

/**
 * Returns whether Auto-check can pull an image, anonymously or with a stored credential.
 * @param {ImageVisibility} visibility - Visibility of the image
 * @returns {boolean} - True for public and credential
 */
export const isCheckable = (visibility: ImageVisibility): boolean =>
  visibility === 'public' || visibility === 'credential'
