import type { DatabaseSync } from 'node:sqlite'

export interface StoredKey {
  id: number
  resolvedAt: string | null
}

export interface StoredFinding extends StoredKey {
  kev: boolean
}

/**
 * Lists the stored findings by vuln_id x image_ref key.
 * @param {DatabaseSync} db - Open database
 * @param {(vulnId: string, imageRef: string) => string} keyOf - Key builder
 * @returns {Map<string, StoredFinding>} - Id, resolution and KEV flag per finding key
 */
export const readStoredFindings = (
  db: DatabaseSync,
  keyOf: (vulnId: string, imageRef: string) => string,
): Map<string, StoredFinding> => {
  const rows = db
    .prepare('SELECT id, vuln_id, image_ref, resolved_at, kev FROM findings')
    .all() as unknown as {
    id: number
    vuln_id: string
    image_ref: string
    resolved_at: string | null
    kev: number
  }[]

  return new Map(
    rows.map((row) => [
      keyOf(row.vuln_id, row.image_ref),
      { id: row.id, resolvedAt: row.resolved_at, kev: row.kev === 1 },
    ]),
  )
}

/**
 * Lists the stored instances by finding id and natural key.
 * @param {DatabaseSync} db - Open database
 * @returns {Map<number, Map<string, StoredKey>>} - Id and resolution per finding and instance key
 */
export const readStoredInstances = (db: DatabaseSync): Map<number, Map<string, StoredKey>> => {
  const rows = db
    .prepare('SELECT id, finding_id, natural_key, resolved_at FROM finding_instances')
    .all() as unknown as {
    id: number
    finding_id: number
    natural_key: string
    resolved_at: string | null
  }[]
  const byFinding = new Map<number, Map<string, StoredKey>>()

  for (const row of rows) {
    const instances = byFinding.get(row.finding_id) ?? new Map<string, StoredKey>()
    instances.set(row.natural_key, { id: row.id, resolvedAt: row.resolved_at })
    byFinding.set(row.finding_id, instances)
  }

  return byFinding
}
