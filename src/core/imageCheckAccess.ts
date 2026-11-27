import { registryScopeFor, type AccessScope } from '#core/accessScope.ts'
import type { ImageCheckAccess } from '#core/privateAccess.ts'
import { sourceAccess } from '#core/sourceAccess.ts'

/**
 * Returns how Auto-check reaches an image: through the registry credential that covers it,
 * else anonymously when it is public, else not at all. Pass no scopes while private access is
 * off (no credentials key or no fetcher), so only public images are reachable.
 * @param {{ imageRef: string; owner: string | null }} image - Image ref and owner label
 * @param {readonly string[]} publicRegistries - Registries whose images count as public
 * @param {readonly AccessScope[]} scopes - Usable credentials
 * @returns {ImageCheckAccess} - Access level with the covering credential
 */
export const imageCheckAccessOf = (
  { imageRef, owner }: { imageRef: string; owner: string | null },
  publicRegistries: readonly string[],
  scopes: readonly AccessScope[],
): ImageCheckAccess => {
  const scope = registryScopeFor(scopes, imageRef)

  if (scope !== null) {
    return { imageRef, level: 'credential', credentialId: scope.id, credentialLabel: scope.label }
  }

  return {
    imageRef,
    level: sourceAccess(imageRef, owner, publicRegistries) === 'public' ? 'public' : 'none',
    credentialId: null,
    credentialLabel: null,
  }
}
