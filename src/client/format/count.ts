const COMPACT_FROM = 10_000

const FULL = new Intl.NumberFormat('en')
const COMPACT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/**
 * Formats a count, in full with grouping below ten thousand and compact above.
 * @param {number} count - Count
 * @returns {string} - Such as "1,284" or "12.9K"
 */
export const formatCount = (count: number): string =>
  Math.abs(count) < COMPACT_FROM ? FULL.format(count) : COMPACT.format(count)

/**
 * Picks the singular or plural form of a noun for a count.
 * @param {number} count - Count
 * @param {string} singular - Form for exactly one, such as "open finding"
 * @param {string} plural - Form for any other count, defaults to the singular with an s
 * @returns {string} - Matching form without the number
 */
export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  count === 1 ? singular : plural

/**
 * Formats a count with its noun in the matching form.
 * @param {number} count - Count
 * @param {string} singular - Form for exactly one, such as "image"
 * @param {string} plural - Form for any other count, defaults to the singular with an s
 * @returns {string} - Such as "1 image" or "1,284 images"
 */
export const countOf = (count: number, singular: string, plural?: string): string =>
  `${formatCount(count)} ${pluralize(count, singular, plural)}`
