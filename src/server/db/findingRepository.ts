import type { DatabaseSync, SQLInputValue } from 'node:sqlite'

import type { Finding } from '#core/finding.ts'
import type { FindingSummary } from '#core/findingView.ts'
import type { Exposure } from '#core/exposure.ts'
import type { Severity } from '#core/severity.ts'

export interface FindingRow {
  id: number
  vuln_id: string
  image_ref: string
  severity: string
  score: number | null
  severity_source: string | null
  kev: number
  exposure: string | null
  owner: string | null
  title: string | null
  primary_link: string | null
  first_seen: string
  last_seen: string
  resolved_at: string | null
}

interface SummaryRow extends FindingRow {
  instance_count: number
  workload_count: number
  namespaces: string | null
  workloads: string | null
  packages: string | null
}

// current instances: open ones, or the last sighting of a resolved finding
const SUMMARY_SELECT = `
  SELECT f.*,
    COUNT(i.id) AS instance_count,
    COUNT(DISTINCT i.namespace || '/' || i.resource_kind || '/' || i.resource_name) AS workload_count,
    GROUP_CONCAT(DISTINCT i.namespace) AS namespaces,
    GROUP_CONCAT(DISTINCT i.namespace || '/' || i.resource_kind || '/' || i.resource_name) AS workloads,
    GROUP_CONCAT(DISTINCT i.package) AS packages
  FROM findings f
  LEFT JOIN finding_instances i ON i.finding_id = f.id
    AND (i.resolved_at IS NULL OR i.resolved_at = f.resolved_at)
`

/**
 * Maps a findings row to the domain type, the CHECK constraints guarantee the literal types.
 * @param {FindingRow} row - Row
 * @returns {Finding} - Finding
 */
export const toFinding = (row: FindingRow): Finding => ({
  id: row.id,
  vulnId: row.vuln_id,
  imageRef: row.image_ref,
  severity: row.severity as Severity,
  score: row.score,
  severitySource: row.severity_source,
  kev: row.kev === 1,
  exposure: row.exposure as Exposure | null,
  owner: row.owner,
  title: row.title,
  primaryLink: row.primary_link,
  firstSeen: row.first_seen,
  lastSeen: row.last_seen,
  resolvedAt: row.resolved_at,
})

/**
 * Splits a GROUP_CONCAT result into a sorted list. Kubernetes names never contain commas.
 * @param {string | null} value - Comma separated values
 * @returns {string[]} - Sorted values
 */
const splitList = (value: string | null): string[] => (value ? value.split(',').sort() : [])

/**
 * Maps a summary row to the domain type.
 * @param {SummaryRow} row - Row with counts
 * @returns {FindingSummary} - Summary
 */
const toSummary = (row: SummaryRow): FindingSummary => ({
  ...toFinding(row),
  instanceCount: row.instance_count,
  workloadCount: row.workload_count,
  namespaces: splitList(row.namespaces),
  workloads: splitList(row.workloads),
  packages: splitList(row.packages),
})

/**
 * Lists findings with counts over their current instances.
 * @param {DatabaseSync} db - Open database
 * @param {{ vulnId?: string; includeResolved?: boolean }} filter - Optional vuln_id, resolved ones
 * @returns {FindingSummary[]} - Findings ordered by id
 */
export const listFindingSummaries = (
  db: DatabaseSync,
  filter: { vulnId?: string; includeResolved?: boolean } = {},
): FindingSummary[] => {
  const where = [
    filter.vulnId === undefined ? null : 'f.vuln_id = :vulnId',
    filter.includeResolved === false ? 'f.resolved_at IS NULL' : null,
  ].filter((clause) => clause !== null)
  const sql = `${SUMMARY_SELECT} ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY f.id ORDER BY f.id`
  const params: Record<string, SQLInputValue> =
    filter.vulnId === undefined ? {} : { vulnId: filter.vulnId }

  return (db.prepare(sql).all(params) as unknown as SummaryRow[]).map(toSummary)
}

/**
 * Reads one finding.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Finding id
 * @returns {Finding | null} - Finding, null when unknown
 */
export const getFinding = (db: DatabaseSync, id: number): Finding | null => {
  const row = db.prepare('SELECT * FROM findings WHERE id = ?').get(id) as FindingRow | undefined

  return row ? toFinding(row) : null
}

/**
 * Lists the findings of one vulnerability.
 * @param {DatabaseSync} db - Open database
 * @param {string} vulnId - Vulnerability id
 * @returns {Finding[]} - Findings ordered by id
 */
export const listFindingsByVuln = (db: DatabaseSync, vulnId: string): Finding[] =>
  (
    db
      .prepare('SELECT * FROM findings WHERE vuln_id = ? ORDER BY id')
      .all(vulnId) as unknown as FindingRow[]
  ).map(toFinding)

/**
 * Lists the findings not resolved by the latest successful sync.
 * @param {DatabaseSync} db - Open database
 * @returns {Finding[]} - Open findings ordered by id
 */
export const listOpenFindings = (db: DatabaseSync): Finding[] =>
  (
    db
      .prepare('SELECT * FROM findings WHERE resolved_at IS NULL ORDER BY id')
      .all() as unknown as FindingRow[]
  ).map(toFinding)

/**
 * Counts the findings not resolved by the latest successful sync.
 * @param {DatabaseSync} db - Open database
 * @returns {number} - Open findings
 */
export const countOpenFindings = (db: DatabaseSync): number =>
  Number(db.prepare('SELECT COUNT(*) AS n FROM findings WHERE resolved_at IS NULL').get()?.n ?? 0)
