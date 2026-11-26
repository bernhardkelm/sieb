import type { ValidationIssue } from '#core/apiTypes.ts'
import { isExposure, type Exposure } from '#core/exposure.ts'
import { isOwner } from '#core/owner.ts'
import { SEVERITIES, type Severity } from '#core/severity.ts'

export const FINDING_LIST_VIEWS = ['inbox', 'all'] as const

export type FindingListView = (typeof FINDING_LIST_VIEWS)[number]

/** Filters of the finding list, empty lists match everything */
export interface FindingQuery {
  view: FindingListView
  includeResolved: boolean // view all only, the inbox never holds resolved findings
  q: string | null
  severity: Severity[]
  exposure: Exposure[]
  owner: string[]
  newSince: string | null // ISO timestamp, first_seen at or after it
}

export type FindingQueryResult =
  | { ok: true; value: FindingQuery }
  | { ok: false; errors: ValidationIssue[] }

type RawQuery = Record<string, string | undefined>

/**
 * Splits a comma separated parameter and checks every entry against the allowed values.
 * @param {string | undefined} raw - Parameter value
 * @param {(value: unknown) => value is T} guard - Type guard of the allowed values
 * @param {string} field - Parameter name for the error
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {T[]} - Valid entries, empty when absent
 */
const readList = <T extends string>(
  raw: string | undefined,
  guard: (value: unknown) => value is T,
  field: string,
  errors: ValidationIssue[],
): T[] => {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')

  if (!entries.every(guard)) {
    errors.push({ field, code: 'invalid' })
    return []
  }

  return entries
}

/**
 * Returns whether a value is a known severity.
 * @param {unknown} value - Value to test
 * @returns {boolean} - True for the title case severities
 */
const isSeverity = (value: unknown): value is Severity =>
  (SEVERITIES as readonly unknown[]).includes(value)

/**
 * Parses the query parameters of the finding list. Lists are comma separated, owner entries are
 * free-form owner labels (no commas, at most OWNER_MAX_LENGTH characters), booleans accept true
 * and 1, newSince takes any parseable timestamp.
 * @param {RawQuery} raw - Query parameters
 * @returns {FindingQueryResult} - Parsed query or the list of errors
 */
export const parseFindingQuery = (raw: RawQuery): FindingQueryResult => {
  const errors: ValidationIssue[] = []
  const view = raw.view ?? 'all'
  const newSince = raw.newSince ? Date.parse(raw.newSince) : null

  if (!(FINDING_LIST_VIEWS as readonly string[]).includes(view)) {
    errors.push({ field: 'view', code: 'invalid' })
  }

  if (newSince !== null && Number.isNaN(newSince)) {
    errors.push({ field: 'newSince', code: 'invalid' })
  }

  const value: FindingQuery = {
    view: view as FindingListView,
    includeResolved: raw.includeResolved === 'true' || raw.includeResolved === '1',
    q: raw.q?.trim() || null,
    severity: readList(raw.severity, isSeverity, 'severity', errors),
    exposure: readList(raw.exposure, isExposure, 'exposure', errors),
    owner: readList(raw.owner, isOwner, 'owner', errors),
    newSince: newSince === null || Number.isNaN(newSince) ? null : new Date(newSince).toISOString(),
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value }
}
