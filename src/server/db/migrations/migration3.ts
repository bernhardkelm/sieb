/** Schema step 3: overview stats recorded by every successful sync, synthetic ones without a run */
export const MIGRATION_3 = `
  CREATE TABLE stats_snapshots (
    id INTEGER PRIMARY KEY,
    sync_run_id INTEGER REFERENCES sync_runs (id),
    taken_at TEXT NOT NULL,
    stats TEXT NOT NULL CHECK (json_valid(stats))
  ) STRICT;
  CREATE INDEX stats_snapshots_taken_at ON stats_snapshots (taken_at);
`
