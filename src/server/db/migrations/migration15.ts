/**
 * Schema step 15: decision_proposals.client_kind records the kind of Claude client that filed a
 * proposal, see PROPOSAL_CLIENT_KINDS. Only a length check, so a later kind needs no table
 * rebuild; reads map unknown values to null. Existing rows keep NULL.
 */
export const MIGRATION_15 = `
  ALTER TABLE decision_proposals ADD COLUMN client_kind TEXT
    CHECK (client_kind IS NULL OR length(client_kind) BETWEEN 1 AND 40);
`
