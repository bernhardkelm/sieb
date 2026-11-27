const MAX_TAG_LENGTH = 129
// a subset of git's ref rules: no leading dash or dot, no slashes, spaces, colons, ~^?*[ or @{
const TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._+-]*$/u

/**
 * Returns whether a name is a git tag the fetcher may ask for: at most 129 characters of
 * letters, digits and ._+-, not starting with a dash or dot, without .., not ending in . or .lock.
 * @param {string} name - Tag name without refs/tags/
 * @returns {boolean} - True for an acceptable tag name
 */
export const isGitTagName = (name: string): boolean =>
  name.length <= MAX_TAG_LENGTH &&
  TAG_PATTERN.test(name) &&
  !name.includes('..') &&
  !name.endsWith('.') &&
  !name.endsWith('.lock')

/**
 * Lists the git tags that may name the commit an image tag was built from: the tag itself, then
 * with a v prefix unless it already has one. latest and missing or invalid tags name none.
 * @param {string | null} imageTag - Tag of the image, null for a digest-only image
 * @returns {string[]} - Tag names to try in order, empty when none applies
 */
export const gitTagCandidates = (imageTag: string | null): string[] => {
  if (imageTag === null || imageTag === 'latest' || !isGitTagName(imageTag)) {
    return []
  }

  const prefixed = `v${imageTag}`

  return /^v\d/u.test(imageTag) || !isGitTagName(prefixed) ? [imageTag] : [imageTag, prefixed]
}
