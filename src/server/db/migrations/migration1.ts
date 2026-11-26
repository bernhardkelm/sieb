/** Schema step 1: findings with their instances, triage decisions with history, sync runs */
export const MIGRATION_1 = `
  CREATE TABLE findings (
    id INTEGER PRIMARY KEY,
    vuln_id TEXT NOT NULL,
    image_ref TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Unknown')),
    score REAL,
    severity_source TEXT,
    kev INTEGER NOT NULL CHECK (kev IN (0, 1)),
    exposure TEXT NOT NULL CHECK (exposure IN ('public', 'gated', 'internal')),
    owner TEXT NOT NULL CHECK (owner IN ('self', 'third-party', 'k3s')),
    title TEXT,
    primary_link TEXT,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    resolved_at TEXT,
    UNIQUE (vuln_id, image_ref)
  ) STRICT;
  CREATE INDEX findings_resolved_at ON findings (resolved_at);

  CREATE TABLE finding_instances (
    id INTEGER PRIMARY KEY,
    finding_id INTEGER NOT NULL REFERENCES findings (id) ON DELETE CASCADE,
    natural_key TEXT NOT NULL,
    namespace TEXT NOT NULL,
    resource_kind TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    container TEXT,
    image_tag TEXT,
    image_digest TEXT,
    package TEXT,
    installed_version TEXT,
    fixed_version TEXT,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    resolved_at TEXT,
    UNIQUE (finding_id, natural_key)
  ) STRICT;

  CREATE TABLE decisions (
    id INTEGER PRIMARY KEY,
    vuln_id TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('image', 'all')),
    image_ref TEXT,
    status TEXT NOT NULL CHECK (status IN ('not_affected', 'accepted', 'fix_planned')),
    reason TEXT NOT NULL CHECK (trim(reason) <> ''),
    expires_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revoked_at TEXT,
    revoked_by TEXT,
    severity_at_decision TEXT NOT NULL
      CHECK (severity_at_decision IN ('Critical', 'High', 'Medium', 'Low', 'Unknown')),
    kev_at_decision INTEGER NOT NULL CHECK (kev_at_decision IN (0, 1)),
    CHECK ((scope = 'image') = (image_ref IS NOT NULL))
  ) STRICT;
  CREATE INDEX decisions_vuln_id ON decisions (vuln_id);
  CREATE UNIQUE INDEX decisions_current
    ON decisions (vuln_id, scope, ifnull(image_ref, ''))
    WHERE revoked_at IS NULL;

  CREATE TABLE decision_events (
    id INTEGER PRIMARY KEY,
    decision_id INTEGER NOT NULL REFERENCES decisions (id),
    type TEXT NOT NULL CHECK (type IN ('created', 'updated', 'revoked', 'expired', 'reopened')),
    actor TEXT NOT NULL,
    at TEXT NOT NULL,
    payload TEXT NOT NULL CHECK (json_valid(payload))
  ) STRICT;
  CREATE INDEX decision_events_decision ON decision_events (decision_id, id);
  CREATE TRIGGER decision_events_no_update BEFORE UPDATE ON decision_events
  BEGIN
    SELECT RAISE(ABORT, 'decision_events is append-only');
  END;
  CREATE TRIGGER decision_events_no_delete BEFORE DELETE ON decision_events
  BEGIN
    SELECT RAISE(ABORT, 'decision_events is append-only');
  END;

  CREATE TABLE sync_runs (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    started_at TEXT NOT NULL,
    finished_at TEXT,
    fetched_at TEXT,
    error TEXT,
    counts TEXT CHECK (counts IS NULL OR json_valid(counts))
  ) STRICT;
`
