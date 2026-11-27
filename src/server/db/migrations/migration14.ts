/**
 * Schema step 14: api_tokens.check_id marks the token minted for a running Auto-check, which
 * sieb hides from the token list, the live-token cap and the Claude connection and binds to that
 * check on /mcp. decision_proposals.check_id marks proposals filed with such a token, which
 * neither replace nor are replaced by the requester's own proposals, so the open-target index
 * includes it. Existing rows are marked from checks.token_id. checks.pulled_digest holds the
 * digest the worker reports it exported.
 */
export const MIGRATION_14 = `
  ALTER TABLE api_tokens ADD COLUMN check_id INTEGER;
  UPDATE api_tokens
    SET check_id = (SELECT checks.id FROM checks WHERE checks.token_id = api_tokens.id)
    WHERE id IN (SELECT token_id FROM checks WHERE token_id IS NOT NULL);
  CREATE UNIQUE INDEX api_tokens_check ON api_tokens (check_id) WHERE check_id IS NOT NULL;
  ALTER TABLE checks ADD COLUMN pulled_digest TEXT
    CHECK (pulled_digest IS NULL OR length(pulled_digest) BETWEEN 1 AND 200);
  ALTER TABLE decision_proposals ADD COLUMN check_id INTEGER;
  UPDATE decision_proposals
    SET check_id = (SELECT checks.id FROM checks WHERE checks.token_id = decision_proposals.token_id)
    WHERE token_id IN (SELECT token_id FROM checks WHERE token_id IS NOT NULL);
  DROP INDEX decision_proposals_open_target;
  CREATE UNIQUE INDEX decision_proposals_open_target
    ON decision_proposals (vuln_id, scope, target_key, proposed_by, coalesce(check_id, 0))
    WHERE state = 'open';
`
