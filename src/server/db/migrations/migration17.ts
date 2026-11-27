/**
 * Schema step 17: decisions.upstream_pending marks a fix_planned decision that waits for an
 * upstream release, decisions.waiting_for names that release. Both are set together and only
 * with an expiry, which serves as the review date. Existing rows get 0 and NULL, which satisfy
 * every check, so no data is rewritten.
 */
export const MIGRATION_17 = `
  ALTER TABLE decisions ADD COLUMN waiting_for TEXT
    CHECK (waiting_for IS NULL OR length(waiting_for) BETWEEN 1 AND 160);
  ALTER TABLE decisions ADD COLUMN upstream_pending INTEGER NOT NULL DEFAULT 0
    CHECK (upstream_pending IN (0, 1))
    CHECK (upstream_pending = 0 OR (status = 'fix_planned' AND expires_at IS NOT NULL))
    CHECK ((upstream_pending = 1) = (waiting_for IS NOT NULL));
`
