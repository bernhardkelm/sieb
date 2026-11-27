import type { LocationQuery } from 'vue-router'

import { INBOX_KINDS, type InboxKind } from '#core/inbox/inboxItem.ts'
import type { InboxFilters } from '@/components/inbox/inboxFilters'
import {
  FILTER_QUERY,
  findingFilterParams,
  listParam,
  readEntries,
  readFindingFilters,
} from '@/router/findingFilterQuery'
import { readQueryParam } from '@/router/queryParam'
import { emptyFilters } from '@/stores/findingFilters'

/** Query param of the kind filter, the other Inbox filters share the Triage params */
export const INBOX_KIND_QUERY = 'kind'

const SHARED = [
  FILTER_QUERY.q,
  FILTER_QUERY.severity,
  FILTER_QUERY.exposure,
  FILTER_QUERY.owner,
  FILTER_QUERY.kev,
] as const

const KINDS: readonly string[] = INBOX_KINDS

/**
 * Reads an Inbox kind entry case-insensitively.
 * @param {string} entry - Param entry
 * @returns {InboxKind | null} - Kind, null for other entries
 */
const readKind = (entry: string): InboxKind | null => {
  const value = entry.toLowerCase()

  return KINDS.includes(value) ? (value as InboxKind) : null
}

/**
 * Reads the Inbox filters from the route query with the rules of the Triage params, so `q`,
 * `sev`, `exp`, `owner` and `kev` mean the same on both views; `kind` takes a comma list of
 * Inbox kinds. Unknown or invalid values are ignored.
 * @param {LocationQuery} query - Route query
 * @returns {InboxFilters} - Filters, empty ones for absent params
 */
export const readInboxFilters = (query: LocationQuery): InboxFilters => {
  const shared = readFindingFilters(query)

  return {
    q: shared.q,
    kind: readEntries(readQueryParam(query, INBOX_KIND_QUERY), readKind),
    severity: shared.severity,
    exposure: shared.exposure,
    owner: shared.owner,
    kev: shared.kev,
  }
}

/**
 * Returns the query params of the Inbox filters, null for each filter that is not set, so
 * withQueryParams removes it.
 * @param {InboxFilters} filters - Filters
 * @returns {Record<string, string | null>} - Value per param
 */
export const inboxFilterParams = (filters: InboxFilters): Record<string, string | null> => {
  const { kind, ...shared } = filters
  const params = findingFilterParams({ ...emptyFilters(), ...shared })

  return {
    ...Object.fromEntries(SHARED.map((param) => [param, params[param] ?? null])),
    [INBOX_KIND_QUERY]: listParam(kind),
  }
}

/**
 * Returns whether two Inbox filter states are equal.
 * @param {InboxFilters} a - First filters
 * @param {InboxFilters} b - Second filters
 * @returns {boolean} - True when every filter matches
 */
export const sameInboxFilters = (a: InboxFilters, b: InboxFilters): boolean =>
  JSON.stringify(inboxFilterParams(a)) === JSON.stringify(inboxFilterParams(b))
