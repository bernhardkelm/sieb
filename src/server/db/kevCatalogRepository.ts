import type { DatabaseSync } from 'node:sqlite'

import type { KevDetails, KevEntry } from '#core/kev.ts'

interface KevCatalogRow {
  vendor_project: string | null
  product: string | null
  vulnerability_name: string | null
  date_added: string
  short_description: string | null
  required_action: string | null
  due_date: string | null
  known_ransomware: number | null
  notes: string | null
}

/**
 * Replaces the stored catalog with the entries of a feed, so CVEs the feed dropped stop being
 * listed. Call it inside a transaction.
 * @param {DatabaseSync} db - Open database
 * @param {readonly KevEntry[]} entries - Validated entries, one per CVE id
 * @returns {void}
 */
export const replaceKevCatalog = (db: DatabaseSync, entries: readonly KevEntry[]): void => {
  const insert = db.prepare(
    `INSERT INTO kev_catalog (cve_id, vendor_project, product, vulnerability_name, date_added,
       short_description, required_action, due_date, known_ransomware, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  db.exec('DELETE FROM kev_catalog')

  for (const entry of entries) {
    insert.run(
      entry.cveId,
      entry.vendorProject,
      entry.product,
      entry.vulnerabilityName,
      entry.dateAdded,
      entry.shortDescription,
      entry.requiredAction,
      entry.dueDate,
      entry.knownRansomware === null ? null : Number(entry.knownRansomware),
      entry.notes,
    )
  }
}

/**
 * Counts the stored catalog entries.
 * @param {DatabaseSync} db - Open database
 * @returns {number} - Entries
 */
export const countKevEntries = (db: DatabaseSync): number =>
  Number(db.prepare('SELECT COUNT(*) AS n FROM kev_catalog').get()?.n ?? 0)

/**
 * Lists the CVE ids of the stored catalog, null while no fetch has succeeded yet, so a sync
 * before the first fetch keeps the stored KEV flags instead of clearing them.
 * @param {DatabaseSync} db - Open database
 * @returns {string[] | null} - Listed CVE ids, null without a stored catalog
 */
export const readKevCatalogIds = (db: DatabaseSync): string[] | null => {
  const feed = db.prepare('SELECT last_success_at FROM kev_feed WHERE id = 1').get()

  if (!feed || feed.last_success_at === null) {
    return null
  }

  return db
    .prepare('SELECT cve_id FROM kev_catalog ORDER BY cve_id')
    .all()
    .map((row) => String(row.cve_id))
}

/**
 * Reads the catalog entry of one CVE.
 * @param {DatabaseSync} db - Open database
 * @param {string} cveId - CVE id
 * @returns {KevDetails | null} - Entry without its id, null when the catalog does not list it
 */
export const getKevDetails = (db: DatabaseSync, cveId: string): KevDetails | null => {
  const row = db.prepare('SELECT * FROM kev_catalog WHERE cve_id = ?').get(cveId) as
    | KevCatalogRow
    | undefined

  if (!row) {
    return null
  }

  return {
    vendorProject: row.vendor_project,
    product: row.product,
    vulnerabilityName: row.vulnerability_name,
    dateAdded: row.date_added,
    shortDescription: row.short_description,
    requiredAction: row.required_action,
    dueDate: row.due_date,
    knownRansomware: row.known_ransomware === null ? null : row.known_ransomware === 1,
    notes: row.notes,
  }
}

/**
 * Lists the CISA date_added of every stored catalog entry.
 * @param {DatabaseSync} db - Open database
 * @returns {Map<string, string>} - YYYY-MM-DD per CVE id
 */
export const listKevDatesAdded = (db: DatabaseSync): Map<string, string> =>
  new Map(
    db
      .prepare('SELECT cve_id, date_added FROM kev_catalog')
      .all()
      .map((row) => [String(row.cve_id), String(row.date_added)]),
  )
