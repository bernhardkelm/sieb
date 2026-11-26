/**
 * Schema step 7: personal API tokens for the MCP endpoint. Only the sha-256 hash of a secret is
 * stored, revoked tokens keep their row so the list shows who revoked them and when.
 */
export const MIGRATION_7 = `
  CREATE TABLE api_tokens (
    id INTEGER PRIMARY KEY,
    owner TEXT NOT NULL CHECK (length(owner) > 0),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 64),
    scope TEXT NOT NULL CHECK (scope IN ('read', 'propose')),
    token_prefix TEXT NOT NULL CHECK (length(token_prefix) > 0),
    token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
    created_at TEXT NOT NULL,
    expires_at TEXT,
    last_used_at TEXT,
    revoked_at TEXT,
    revoked_by TEXT,
    CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
  ) STRICT;
  CREATE INDEX api_tokens_owner ON api_tokens (owner);
`
