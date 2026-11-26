/**
 * Schema step 2: per-image decision baselines and the latched re-open. Seeds a baseline from the
 * old decision-wide snapshot for every image a current decision governs.
 */
export const MIGRATION_2 = `
  ALTER TABLE decisions ADD COLUMN reopened_at TEXT;
  ALTER TABLE decisions ADD COLUMN reopen_trigger TEXT
    CHECK (reopen_trigger IS NULL OR json_valid(reopen_trigger))
    CHECK ((reopened_at IS NULL) = (reopen_trigger IS NULL));

  CREATE TABLE decision_baselines (
    decision_id INTEGER NOT NULL REFERENCES decisions (id),
    image_ref TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Unknown')),
    kev INTEGER NOT NULL CHECK (kev IN (0, 1)),
    recorded_at TEXT NOT NULL,
    PRIMARY KEY (decision_id, image_ref)
  ) STRICT;

  INSERT INTO decision_baselines (decision_id, image_ref, severity, kev, recorded_at)
  SELECT d.id, f.image_ref, d.severity_at_decision, d.kev_at_decision, d.updated_at
  FROM decisions d
  JOIN findings f ON f.vuln_id = d.vuln_id
  WHERE d.revoked_at IS NULL
    AND (d.scope = 'all' OR f.image_ref = d.image_ref)
    AND (d.scope = 'image' OR NOT EXISTS (
      SELECT 1 FROM decisions own
      WHERE own.vuln_id = d.vuln_id AND own.scope = 'image' AND own.image_ref = f.image_ref
        AND own.revoked_at IS NULL
    ));
`
