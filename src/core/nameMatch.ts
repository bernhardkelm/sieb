/** Trailing wildcard of a name pattern that turns it into a prefix match */
export const PREFIX_WILDCARD = '*'

/**
 * Returns whether a name matches a pattern case-insensitively: exactly, or by prefix when the
 * pattern ends with PREFIX_WILDCARD.
 * @param {string} name - Name to test
 * @param {string} pattern - Exact name or prefix followed by the wildcard
 * @returns {boolean} - True on a match
 */
export const matchesNamePattern = (name: string, pattern: string): boolean => {
  const value = name.toLowerCase()
  const needle = pattern.toLowerCase()

  return needle.endsWith(PREFIX_WILDCARD)
    ? value.startsWith(needle.slice(0, -PREFIX_WILDCARD.length))
    : value === needle
}

/**
 * Returns whether any of several names matches any pattern.
 * @param {readonly string[]} names - Names of a finding
 * @param {readonly string[] | undefined} patterns - Patterns, absent or empty matches everything
 * @returns {boolean} - True on a match
 */
export const matchesAnyName = (
  names: readonly string[],
  patterns: readonly string[] | undefined,
): boolean =>
  patterns === undefined ||
  patterns.length === 0 ||
  names.some((name) => patterns.some((pattern) => matchesNamePattern(name, pattern)))

/**
 * Drops the tag or digest of an image pattern, sieb stores image_refs without them.
 * @param {string} pattern - Image pattern, for example ghcr.io/org/app:1.2@sha256:abc
 * @returns {string} - Pattern without tag and digest
 */
export const withoutImageTag = (pattern: string): string => {
  const untagged = pattern.split('@')[0] ?? pattern
  const lastSlash = untagged.lastIndexOf('/')
  const colon = untagged.indexOf(':', lastSlash + 1)

  return colon === -1 ? untagged : untagged.slice(0, colon)
}

/**
 * Returns the names a workload pattern is matched against: namespace/kind/name, namespace/name
 * and the resource name alone.
 * @param {string} workload - Workload as namespace/kind/name
 * @returns {string[]} - Candidate names
 */
export const workloadNames = (workload: string): string[] => {
  const [namespace, , name] = workload.split('/')

  return namespace === undefined || name === undefined
    ? [workload]
    : [workload, `${namespace}/${name}`, name]
}
