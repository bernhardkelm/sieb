/**
 * Schema step 5: the CISA KEV catalog of the cisa KEV source and the health of its fetches.
 * kev_feed holds exactly one row; entry_count mirrors kev_catalog after the last success.
 */
export const MIGRATION_5 = `
  CREATE TABLE kev_catalog (
    cve_id TEXT PRIMARY KEY,
    vendor_project TEXT,
    product TEXT,
    vulnerability_name TEXT,
    date_added TEXT NOT NULL,
    short_description TEXT,
    required_action TEXT,
    due_date TEXT,
    known_ransomware INTEGER CHECK (known_ransomware IS NULL OR known_ransomware IN (0, 1)),
    notes TEXT
  ) STRICT;

  CREATE TABLE kev_feed (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_attempt_at TEXT,
    last_success_at TEXT,
    last_error TEXT,
    catalog_version TEXT,
    date_released TEXT,
    entry_count INTEGER NOT NULL DEFAULT 0
  ) STRICT;
  INSERT INTO kev_feed (id) VALUES (1);
`
