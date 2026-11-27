import { registryScopeFor } from '#core/accessScope.ts'
import { visibilityOf, type ImageAccessSources } from '#core/imageVisibility.ts'
import type { ImageCheckAccess } from '#core/privateAccess.ts'

/**
 * Returns how Auto-check reaches an image: through the registry credential that covers it,
 * else anonymously when it is public, else not at all. Sources without scopes while private
 * access is off (no credentials key or no fetcher) reach public images only.
 * @param {{ imageRef: string; owner: string | null }} image - Image ref and owner label
 * @param {ImageAccessSources} sources - Probe results, public registries and usable credentials
 * @returns {ImageCheckAccess} - Access level with the covering credential
 */
export const imageCheckAccessOf = (
  image: { imageRef: string; owner: string | null },
  sources: ImageAccessSources,
): ImageCheckAccess => {
  const { imageRef } = image
  const scope = registryScopeFor(sources.scopes, imageRef)

  if (scope !== null) {
    return { imageRef, level: 'credential', credentialId: scope.id, credentialLabel: scope.label }
  }

  return {
    imageRef,
    level: visibilityOf(image, sources) === 'public' ? 'public' : 'none',
    credentialId: null,
    credentialLabel: null,
  }
}
