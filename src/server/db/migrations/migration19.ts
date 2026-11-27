/**
 * Schema step 19: decision_proposals.related_findings, the other open findings Claude says share
 * the cause of the verdict as a JSON array of { findingId, note }, at most 50, and the nullable
 * related_reason, the shared cause in one sentence. Existing rows read as without related
 * findings; an accept never decides them.
 */
export const MIGRATION_19 = `
  ALTER TABLE decision_proposals ADD COLUMN related_findings TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(related_findings) AND json_type(related_findings) = 'array'
      AND json_array_length(related_findings) <= 50);
  ALTER TABLE decision_proposals ADD COLUMN related_reason TEXT
    CHECK (related_reason IS NULL OR length(related_reason) BETWEEN 1 AND 1000);
`
