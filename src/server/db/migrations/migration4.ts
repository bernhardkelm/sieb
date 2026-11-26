/**
 * Schema step 4: optional finding labels. Exposure becomes nullable (unknown), owner a nullable
 * free-form text without the fixed value list. SQLite cannot drop constraints, so findings is
 * rebuilt; finding_instances is rebuilt with it because dropping findings with foreign keys on
 * would cascade into its instances. Ids and every row are kept, stored exposure and owner values
 * stay as they are until the next sync rewrites the open findings.
 */
export const MIGRATION_4 = `
  CREATE TABLE findings_next (
    id INTEGER PRIMARY KEY,
    vuln_id TEXT NOT NULL,
    image_ref TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Unknown')),
    score REAL,
    severity_source TEXT,
    kev INTEGER NOT NULL CHECK (kev IN (0, 1)),
    exposure TEXT CHECK (exposure IS NULL OR exposure IN ('public', 'gated', 'internal')),
    owner TEXT,
    title TEXT,
    primary_link TEXT,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    resolved_at TEXT,
    UNIQUE (vuln_id, image_ref)
  ) STRICT;
  INSERT INTO findings_next (id, vuln_id, image_ref, severity, score, severity_source, kev,
    exposure, owner, title, primary_link, first_seen, last_seen, resolved_at)
  SELECT id, vuln_id, image_ref, severity, score, severity_source, kev, exposure, owner, title,
    primary_link, first_seen, last_seen, resolved_at
  FROM findings;

  CREATE TABLE finding_instances_next (
    id INTEGER PRIMARY KEY,
    finding_id INTEGER NOT NULL REFERENCES findings_next (id) ON DELETE CASCADE,
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
  INSERT INTO finding_instances_next (id, finding_id, natural_key, namespace, resource_kind,
    resource_name, container, image_tag, image_digest, package, installed_version, fixed_version,
    first_seen, last_seen, resolved_at)
  SELECT id, finding_id, natural_key, namespace, resource_kind, resource_name, container,
    image_tag, image_digest, package, installed_version, fixed_version, first_seen, last_seen,
    resolved_at
  FROM finding_instances;

  DROP TABLE finding_instances;
  DROP TABLE findings;
  ALTER TABLE findings_next RENAME TO findings;
  ALTER TABLE finding_instances_next RENAME TO finding_instances;
  CREATE INDEX findings_resolved_at ON findings (resolved_at);
`
