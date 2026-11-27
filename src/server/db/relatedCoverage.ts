import type { DatabaseSync } from 'node:sqlite'

/**
 * Maps every finding an open proposal lists in its relatedFindings to the newest such proposal.
 * A proposal's own targets are not part of it.
 * @param {DatabaseSync} db - Open database
 * @returns {Map<number, number>} - Finding id to proposal id
 */
export const readRelatedCoverage = (db: DatabaseSync): Map<number, number> => {
  const rows = db
    .prepare(
      `SELECT CAST(json_extract(related.value, '$.findingId') AS INTEGER) AS finding_id,
              MAX(p.id) AS proposal_id
       FROM decision_proposals p, json_each(p.related_findings) AS related
       WHERE p.state = 'open'
       GROUP BY finding_id`,
    )
    .all() as { finding_id: number | null; proposal_id: number }[]

  return new Map(
    rows
      .filter((row) => row.finding_id !== null)
      .map((row) => [Number(row.finding_id), Number(row.proposal_id)]),
  )
}
