import type { ValidationIssue } from '#core/errorApiTypes.ts'

// bidirectional marks, overrides and isolates can make plain text render in a misleading order
const BIDI_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu
// zero-width and soft hyphen characters hide inside words and links
const INVISIBLES = /[\u00AD\u200B-\u200D\u2060\uFEFF]/gu
const LINE_CONTROLS = /[\p{Cc}]/gu
const ALL_CONTROLS = /\p{Cc}+/gu

/**
 * Removes control, bidirectional formatting and invisible characters from free text. Multi-line
 * text keeps its line breaks and turns tabs into spaces, single-line text turns every control into
 * a space.
 * @param {string} text - Raw text
 * @param {boolean} multiline - Whether line breaks are kept
 * @returns {string} - Cleaned, trimmed text
 */
export const cleanText = (text: string, multiline: boolean): string => {
  const normalized = text
    .replaceAll(/\r\n?/gu, '\n')
    .replaceAll(BIDI_CONTROLS, '')
    .replaceAll(INVISIBLES, '')
  const cleaned = multiline
    ? normalized.replaceAll(LINE_CONTROLS, (char) =>
        char === '\n' ? '\n' : char === '\t' ? ' ' : '',
      )
    : normalized.replaceAll(ALL_CONTROLS, ' ')

  return cleaned.trim()
}

export interface TextRule {
  max: number
  multiline?: boolean
  required?: boolean
}

/**
 * Reads a free text field: cleaned with cleanText, at most rule.max characters.
 * @param {unknown} value - Raw value
 * @param {string} field - Field name for the error
 * @param {TextRule} rule - Length cap, line breaks, whether it must be present
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string | null} - Text, null when absent, blank or invalid
 */
export const readProposalText = (
  value: unknown,
  field: string,
  rule: TextRule,
  errors: ValidationIssue[],
): string | null => {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    errors.push({ field, code: 'invalid' })
    return null
  }

  const text = typeof value === 'string' ? cleanText(value, rule.multiline === true) : ''

  if (text === '') {
    if (rule.required === true) {
      errors.push({ field, code: 'required' })
    }

    return null
  }

  if (text.length > rule.max) {
    errors.push({ field, code: 'too_long' })
    return null
  }

  return text
}

/**
 * Reads a list field: absent or null is empty, at most maxItems entries, each read by readItem.
 * Entries readItem refuses are left out, it reports them.
 * @param {unknown} value - Raw value
 * @param {string} field - Field name for the error, items are reported as field.index
 * @param {number} maxItems - Longest allowed list
 * @param {(item: unknown, itemField: string) => T | null} readItem - Reads one entry
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {T[]} - Read entries
 */
export const readProposalList = <T>(
  value: unknown,
  field: string,
  maxItems: number,
  readItem: (item: unknown, itemField: string) => T | null,
  errors: ValidationIssue[],
): T[] => {
  if (value === undefined || value === null) {
    return []
  }

  if (!Array.isArray(value)) {
    errors.push({ field, code: 'invalid' })
    return []
  }

  if (value.length > maxItems) {
    errors.push({ field, code: 'too_many' })
    return []
  }

  return value.flatMap((item: unknown, index) => {
    const read = readItem(item, `${field}.${index}`)

    return read === null ? [] : [read]
  })
}

/**
 * Reads one of a list of allowed literals.
 * @param {unknown} value - Raw value
 * @param {readonly T[]} allowed - Allowed literals
 * @param {string} field - Field name for the error
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {T | null} - Literal, null when missing or invalid
 */
export const readProposalEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  errors: ValidationIssue[],
): T | null => {
  if ((allowed as readonly unknown[]).includes(value)) {
    return value as T
  }

  errors.push({ field, code: value === undefined || value === null ? 'required' : 'invalid' })
  return null
}

/**
 * Returns whether a text is an absolute http or https URL without credentials or whitespace.
 * @param {string} text - Candidate URL
 * @returns {boolean} - True for a usable link
 */
export const isHttpUrl = (text: string): boolean => {
  if (/\s/u.test(text) || !URL.canParse(text)) {
    return false
  }

  const url = new URL(text)

  return ['http:', 'https:'].includes(url.protocol) && url.username === '' && url.password === ''
}
