/**
 * Schema step 10: the Inbox. findings.kev_since holds the sync time a finding became KEV listed,
 * existing rows keep NULL. inbox_seen stores per user which expiring and KEV items were marked as
 * seen, the periodic cleanup prunes old rows.
 */
export const MIGRATION_10 = `
  ALTER TABLE findings ADD COLUMN kev_since TEXT CHECK (kev_since IS NULL OR kev = 1);
  CREATE INDEX findings_kev_since ON findings (kev_since) WHERE kev_since IS NOT NULL;

  CREATE TABLE inbox_seen (
    username TEXT NOT NULL CHECK (length(username) > 0),
    item_key TEXT NOT NULL CHECK (length(item_key) BETWEEN 1 AND 200),
    seen_at TEXT NOT NULL,
    PRIMARY KEY (username, item_key)
  ) STRICT;
  CREATE INDEX inbox_seen_seen_at ON inbox_seen (seen_at);
`
