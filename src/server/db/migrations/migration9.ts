/**
 * Schema step 9: decision proposals filed through MCP. A proposal names a vulnerability with one
 * or more images (scope image) or every image (scope all), carries the structured claims as text
 * and JSON columns and stays without effect on suppression until a human accepts it. target_key
 * is the sorted JSON list of image_refs, '*' for scope all, so one proposer holds at most one
 * open proposal per target. token_id has no foreign key, the token cleanup deletes old tokens.
 */
export const MIGRATION_9 = `
  CREATE TABLE decision_proposals (
    id INTEGER PRIMARY KEY,
    vuln_id TEXT NOT NULL CHECK (length(vuln_id) BETWEEN 1 AND 256),
    scope TEXT NOT NULL CHECK (scope IN ('image', 'all')),
    image_refs TEXT CHECK (image_refs IS NULL OR (json_valid(image_refs)
      AND json_type(image_refs) = 'array' AND json_array_length(image_refs) BETWEEN 1 AND 200)),
    target_key TEXT NOT NULL CHECK (length(target_key) > 0),
    verdict TEXT NOT NULL
      CHECK (verdict IN ('not_affected', 'accepted', 'fix_planned', 'needs_patch')),
    justification TEXT CHECK (justification IS NULL OR justification IN ('component_not_present',
      'vulnerable_code_not_present', 'vulnerable_code_not_in_execute_path',
      'vulnerable_code_cannot_be_controlled_by_adversary', 'inline_mitigations_already_exist')),
    summary TEXT NOT NULL CHECK (length(trim(summary)) BETWEEN 1 AND 1000),
    confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
    presence TEXT CHECK (presence IS NULL OR length(presence) BETWEEN 1 AND 4000),
    reachability TEXT CHECK (reachability IS NULL OR length(reachability) BETWEEN 1 AND 4000),
    exposure TEXT CHECK (exposure IS NULL OR length(exposure) BETWEEN 1 AND 4000),
    evidence TEXT NOT NULL CHECK (json_valid(evidence) AND json_type(evidence) = 'array'
      AND json_array_length(evidence) <= 30),
    fix TEXT CHECK (fix IS NULL OR (json_valid(fix) AND json_type(fix) = 'object')),
    review TEXT CHECK (review IS NULL OR (json_valid(review) AND json_type(review) = 'object')),
    unknowns TEXT NOT NULL CHECK (json_valid(unknowns) AND json_type(unknowns) = 'array'
      AND json_array_length(unknowns) <= 20),
    refs TEXT NOT NULL CHECK (json_valid(refs) AND json_type(refs) = 'array'
      AND json_array_length(refs) <= 20),
    evidence_basis TEXT NOT NULL CHECK (json_valid(evidence_basis)
      AND json_type(evidence_basis) = 'array' AND json_array_length(evidence_basis) BETWEEN 1 AND 5),
    source_access TEXT NOT NULL
      CHECK (json_valid(source_access) AND json_type(source_access) = 'array'),
    proposed_by TEXT NOT NULL CHECK (length(proposed_by) > 0),
    proposed_via TEXT NOT NULL CHECK (proposed_via IN ('token', 'oauth')),
    token_id INTEGER,
    client_label TEXT NOT NULL CHECK (length(client_label) BETWEEN 1 AND 256),
    agent TEXT CHECK (agent IS NULL OR length(agent) BETWEEN 1 AND 100),
    basis_decisions TEXT NOT NULL
      CHECK (json_valid(basis_decisions) AND json_type(basis_decisions) = 'array'),
    state TEXT NOT NULL DEFAULT 'open'
      CHECK (state IN ('open', 'accepted', 'rejected', 'superseded')),
    resolution TEXT CHECK (resolution IS NULL OR resolution IN ('accepted', 'accepted_edited',
      'rejected', 'replaced', 'other_accepted', 'finding_resolved')),
    resolution_note TEXT CHECK (resolution_note IS NULL OR length(resolution_note) BETWEEN 1 AND 2000),
    decision_ids TEXT NOT NULL DEFAULT '[]'
      CHECK (json_valid(decision_ids) AND json_type(decision_ids) = 'array'),
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    resolved_by TEXT,
    CHECK ((scope = 'image') = (image_refs IS NOT NULL)),
    CHECK ((scope = 'all') = (target_key = '*')),
    CHECK ((token_id IS NOT NULL) = (proposed_via = 'token')),
    CHECK (justification IS NULL OR verdict = 'not_affected'),
    CHECK ((state = 'open') = (resolution IS NULL)),
    CHECK ((state = 'open') = (resolved_at IS NULL)),
    CHECK ((state = 'open') = (resolved_by IS NULL)),
    CHECK (state = 'open'
      OR (state = 'accepted' AND resolution IN ('accepted', 'accepted_edited'))
      OR (state = 'rejected' AND resolution = 'rejected' AND resolution_note IS NOT NULL)
      OR (state = 'superseded' AND resolution IN ('replaced', 'other_accepted', 'finding_resolved')))
  ) STRICT;
  CREATE UNIQUE INDEX decision_proposals_open_target
    ON decision_proposals (vuln_id, scope, target_key, proposed_by)
    WHERE state = 'open';
  CREATE INDEX decision_proposals_vuln_id ON decision_proposals (vuln_id, state);
  CREATE INDEX decision_proposals_proposer ON decision_proposals (proposed_by, state);
`
