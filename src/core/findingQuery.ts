import type { ValidationIssue } from '#core/apiTypes.ts'
import { isDecisionStateFilter, type DecisionStateFilter } from '#core/decisionStateFilter.ts'
import { isExposure, type Exposure } from '#core/exposure.ts'
import { isOwner } from '#core/owner.ts'
import {
  readList,
  readNamePatterns,
  readNumber,
  readOptionalBoolean,
  readTimestamp,
} from '#core/queryParamReaders.ts'
import { SEVERITIES, type Severity } from '#core/severity.ts'

export const FINDING_LIST_VIEWS = ['inbox', 'all'] as const

export type FindingListView = (typeof FINDING_LIST_VIEWS)[number]

/**
 * Filters of the finding list, empty lists match everything. Name patterns match exactly or,
 * with a trailing *, by prefix, both case-insensitive; absent optional filters match everything.
 */
export interface FindingQuery {
  view: FindingListView
  includeResolved: boolean // view all only, the inbox never holds resolved findings
  q: string | null
  severity: Severity[]
  exposure: Exposure[]
  owner: string[]
  newSince: string | null // ISO timestamp, first_seen at or after it
  kev: boolean // only findings listed in the KEV catalog
  vulnIds?: string[]
  packages?: string[]
  images?: string[] // tag and digest of a pattern are ignored
  namespaces?: string[]
  workloads?: string[] // namespace/kind/name, namespace/name or the resource name
  minScore?: number | null // score at or above it, findings without a score never match
  decisionState?: DecisionStateFilter[]
  kevAddedSince?: string | null // YYYY-MM-DD, CISA date_added on or after it, needs the cisa catalog
  fixable?: boolean | null // true: a current instance has a fixed version, false: none has
}

export type FindingQueryResult =
  | { ok: true; value: FindingQuery }
  | { ok: false; errors: ValidationIssue[] }

type RawQuery = Record<string, string | undefined>

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
 * and 1 (includeResolved, kev; fixable also false and 0), newSince and kevAddedSince take any
 * parseable timestamp, minScore a number from 0 to 10.
 * @param {RawQuery} raw - Query parameters
 * @returns {FindingQueryResult} - Parsed query or the list of errors
 */
export const parseFindingQuery = (raw: RawQuery): FindingQueryResult => {
  const errors: ValidationIssue[] = []
  const view = raw.view ?? 'all'

  if (!(FINDING_LIST_VIEWS as readonly string[]).includes(view)) {
    errors.push({ field: 'view', code: 'invalid' })
  }

  const newSince = readTimestamp(raw.newSince, 'newSince', errors)
  const value: FindingQuery = {
    view: view as FindingListView,
    includeResolved: raw.includeResolved === 'true' || raw.includeResolved === '1',
    q: raw.q?.trim() || null,
    severity: readList(raw.severity, isSeverity, 'severity', errors),
    exposure: readList(raw.exposure, isExposure, 'exposure', errors),
    owner: readList(raw.owner, isOwner, 'owner', errors),
    kev: raw.kev === 'true' || raw.kev === '1',
    newSince,
    vulnIds: readNamePatterns(raw.vulnIds, 'vulnIds', errors),
    packages: readNamePatterns(raw.packages, 'packages', errors),
    images: readNamePatterns(raw.images, 'images', errors),
    namespaces: readNamePatterns(raw.namespaces, 'namespaces', errors),
    workloads: readNamePatterns(raw.workloads, 'workloads', errors),
    minScore: readNumber(raw.minScore, { min: 0, max: 10 }, 'minScore', errors),
    decisionState: readList(raw.decisionState, isDecisionStateFilter, 'decisionState', errors),
    kevAddedSince: readTimestamp(raw.kevAddedSince, 'kevAddedSince', errors)?.slice(0, 10) ?? null,
    fixable: readOptionalBoolean(raw.fixable, 'fixable', errors),
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value }
}
