import type { KevEntry } from '#core/kev.ts'
import { asRecord, asText } from '#server/sources/mapping/jsonAccess.ts'

/** Validated CISA KEV catalog */
export interface KevFeed {
  catalogVersion: string | null
  dateReleased: string | null
  entries: KevEntry[] // valid entries, one per CVE id, in feed order
  skipped: number // entries without a valid cveID or dateAdded, or repeating a CVE id
}

export const MAX_KEV_TEXT_LENGTH = 4000

const CVE_ID_PATTERN = /^CVE-\d{4}-\d{4,}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Returns a trimmed text field, capped at MAX_KEV_TEXT_LENGTH characters.
 * @param {unknown} value - Parsed JSON value
 * @returns {string | null} - Text, null when missing, blank or not a string
 */
const textField = (value: unknown): string | null => {
  const text = asText(value)?.trim()

  return text ? text.slice(0, MAX_KEV_TEXT_LENGTH) : null
}

/**
 * Returns a YYYY-MM-DD date field.
 * @param {unknown} value - Parsed JSON value
 * @returns {string | null} - Date, null when missing or malformed
 */
const dateField = (value: unknown): string | null => {
  const text = asText(value)?.trim()

  return text && DATE_PATTERN.test(text) ? text : null
}

/**
 * Maps knownRansomwareCampaignUse, which the feed fills with "Known" or "Unknown".
 * @param {unknown} value - Parsed JSON value
 * @returns {boolean | null} - True for Known, false for Unknown, null for anything else
 */
const ransomwareField = (value: unknown): boolean | null => {
  const text = asText(value)?.trim().toLowerCase()

  if (text === 'known') {
    return true
  }

  return text === 'unknown' ? false : null
}

/**
 * Maps one catalog entry.
 * @param {unknown} value - Entry of the vulnerabilities list
 * @returns {KevEntry | null} - Entry, null without a valid cveID or dateAdded
 */
const parseEntry = (value: unknown): KevEntry | null => {
  const raw = asRecord(value)
  const cveId = asText(raw.cveID)?.trim().toUpperCase()
  const dateAdded = dateField(raw.dateAdded)

  if (!cveId || !CVE_ID_PATTERN.test(cveId) || !dateAdded) {
    return null
  }

  return {
    cveId,
    vendorProject: textField(raw.vendorProject),
    product: textField(raw.product),
    vulnerabilityName: textField(raw.vulnerabilityName),
    dateAdded,
    shortDescription: textField(raw.shortDescription),
    requiredAction: textField(raw.requiredAction),
    dueDate: dateField(raw.dueDate),
    knownRansomware: ransomwareField(raw.knownRansomwareCampaignUse),
    notes: textField(raw.notes),
  }
}

/**
 * Validates a parsed CISA KEV feed. Entries without a valid cveID or dateAdded are skipped, a
 * repeated CVE id keeps its first entry. A feed without a vulnerabilities list, whose count
 * disagrees with the list, or without a single valid entry is rejected, so a truncated or
 * changed feed never replaces a stored catalog.
 * @param {unknown} json - Parsed feed
 * @returns {KevFeed} - Validated catalog
 * @throws {Error} - When the feed does not have the expected shape or lists no valid entry
 */
export const parseKevFeed = (json: unknown): KevFeed => {
  const feed = asRecord(json)

  if (!Array.isArray(feed.vulnerabilities)) {
    throw new Error('KEV feed has no vulnerabilities list')
  }

  if (typeof feed.count === 'number' && feed.count !== feed.vulnerabilities.length) {
    throw new Error(
      `KEV feed count ${feed.count} does not match its ${feed.vulnerabilities.length} entries`,
    )
  }

  const entries = new Map<string, KevEntry>()

  for (const value of feed.vulnerabilities) {
    const entry = parseEntry(value)

    if (entry && !entries.has(entry.cveId)) {
      entries.set(entry.cveId, entry)
    }
  }

  if (entries.size === 0) {
    throw new Error('KEV feed lists no valid entry')
  }

  return {
    catalogVersion: textField(feed.catalogVersion),
    dateReleased: textField(feed.dateReleased),
    entries: [...entries.values()],
    skipped: feed.vulnerabilities.length - entries.size,
  }
}
