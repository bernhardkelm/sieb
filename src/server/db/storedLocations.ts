import type { PackageLocation } from '#core/packageOrigin.ts'

/**
 * Serialises the locations of an instance for finding_instances.locations.
 * @param {readonly PackageLocation[]} locations - Locations
 * @returns {string | null} - JSON array, null when there are none
 */
export const toStoredLocations = (locations: readonly PackageLocation[]): string | null =>
  locations.length > 0
    ? JSON.stringify(locations.map(({ target, pkgPath }) => ({ target, pkgPath })))
    : null

/**
 * Returns a stored value as a string or null.
 * @param {unknown} value - Parsed JSON value
 * @returns {string | null} - String, null for anything else
 */
const stringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null)

/**
 * Parses finding_instances.locations, skipping entries of an unexpected shape.
 * @param {string | null} text - Stored JSON array, null before the first sync wrote it
 * @returns {PackageLocation[]} - Locations, empty when none are stored
 */
export const parseStoredLocations = (text: string | null): PackageLocation[] => {
  if (text === null) {
    return []
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }

  return (Array.isArray(parsed) ? parsed : []).flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) {
      return []
    }

    const { target, pkgPath } = entry as Record<string, unknown>
    const location = { target: stringOrNull(target), pkgPath: stringOrNull(pkgPath) }

    return location.target === null && location.pkgPath === null ? [] : [location]
  })
}
