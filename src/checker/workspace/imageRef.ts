/**
 * Returns the repository of an image reference, without tag and digest.
 * @param {string} ref - Reference such as registry:5000/app:1.2 or app@sha256:...
 * @returns {string} - Repository such as registry:5000/app
 */
export const repositoryOf = (ref: string): string => {
  const at = ref.indexOf('@')
  const base = at === -1 ? ref : ref.slice(0, at)
  const colon = base.lastIndexOf(':')

  // a colon before the last slash separates a registry port, not a tag
  return colon > base.lastIndexOf('/') ? base.slice(0, colon) : base
}

/**
 * Returns the digest an image reference pins.
 * @param {string} ref - Reference
 * @returns {string | null} - Digest after the @, null for a tagged reference
 */
export const digestOfRef = (ref: string): string | null => {
  const at = ref.indexOf('@')

  return at === -1 ? null : ref.slice(at + 1)
}

/**
 * Returns whether an image reference names a tag or a digest, so it never pulls latest.
 * @param {string} ref - Reference
 * @returns {boolean} - Whether a tag or digest is present
 */
export const isPinnedRef = (ref: string): boolean =>
  digestOfRef(ref) !== null || repositoryOf(ref) !== ref

/**
 * Returns the tag an image reference names.
 * @param {string} ref - Reference such as app:1.2 or app:1.2@sha256:...
 * @returns {string | null} - Tag, null for a reference by digest only
 */
export const tagOfRef = (ref: string): string | null => {
  const at = ref.indexOf('@')
  const base = at === -1 ? ref : ref.slice(0, at)
  const repository = repositoryOf(base)

  return repository === base ? null : base.slice(repository.length + 1)
}
