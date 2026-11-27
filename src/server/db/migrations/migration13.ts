/**
 * Schema step 13: checks holds the Auto-check queue, one row per requested check of a finding.
 * Queued and running are open, at most one open check per finding and one running check
 * overall. token_id names the personal token minted on claim and stays after that token is
 * deleted, so the proposal filed with it can be linked; usage holds the Claude usage as JSON.
 */
export const MIGRATION_13 = `
  CREATE TABLE checks (
    id INTEGER PRIMARY KEY,
    finding_id INTEGER NOT NULL,
    vuln_id TEXT NOT NULL CHECK (length(vuln_id) > 0),
    image_ref TEXT NOT NULL CHECK (length(image_ref) > 0),
    requested_by TEXT NOT NULL CHECK (length(requested_by) > 0),
    state TEXT NOT NULL DEFAULT 'queued'
      CHECK (state IN ('queued', 'running', 'done', 'failed', 'cancelled')),
    phase TEXT CHECK (phase IS NULL OR phase IN ('preparing', 'investigating', 'reporting')),
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    heartbeat_at TEXT,
    token_id INTEGER,
    proposal_id INTEGER,
    error TEXT CHECK (error IS NULL OR length(error) BETWEEN 1 AND 500),
    duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
    usage TEXT CHECK (usage IS NULL OR (json_valid(usage) AND json_type(usage) = 'object')),
    reply TEXT CHECK (reply IS NULL OR length(reply) BETWEEN 1 AND 4000),
    CHECK ((state IN ('queued', 'running')) = (finished_at IS NULL)),
    CHECK (state <> 'queued' OR (started_at IS NULL AND token_id IS NULL)),
    CHECK (state <> 'running' OR (started_at IS NOT NULL AND heartbeat_at IS NOT NULL)),
    CHECK (state NOT IN ('running', 'done') OR started_at IS NOT NULL),
    CHECK (error IS NULL OR state = 'failed')
  ) STRICT;
  CREATE UNIQUE INDEX checks_open_finding ON checks (finding_id)
    WHERE state IN ('queued', 'running');
  CREATE UNIQUE INDEX checks_single_running ON checks (state) WHERE state = 'running';
  CREATE INDEX checks_open ON checks (state, id) WHERE state IN ('queued', 'running');
  CREATE INDEX checks_finished ON checks (finished_at) WHERE finished_at IS NOT NULL;
`
