/**
 * Schema step 12: where Trivy found the package of an instance. locations holds a JSON array of
 * {target, pkgPath} objects, one per distinct place, so one package in two binaries of a
 * container keeps both; package_type, package_class and purl are the Trivy package type, class
 * and PURL. Existing rows stay NULL until the next sync writes them.
 */
export const MIGRATION_12 = `
  ALTER TABLE finding_instances ADD COLUMN locations TEXT
    CHECK (locations IS NULL OR (json_valid(locations) AND json_type(locations) = 'array'));
  ALTER TABLE finding_instances ADD COLUMN package_type TEXT;
  ALTER TABLE finding_instances ADD COLUMN package_class TEXT;
  ALTER TABLE finding_instances ADD COLUMN purl TEXT;
`
