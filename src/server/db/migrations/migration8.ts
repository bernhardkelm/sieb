/**
 * Schema step 8: UI login sessions of the oidc auth mode. Only the sha-256 hex of the random
 * session id is stored, the cookie carries the id itself. Sessions end at expires_at, use never
 * extends them; id_token is kept as the id_token_hint of the logout.
 */
export const MIGRATION_8 = `
  CREATE TABLE sessions (
    id_hash TEXT PRIMARY KEY CHECK (length(id_hash) = 64),
    username TEXT NOT NULL CHECK (length(username) > 0),
    groups TEXT NOT NULL CHECK (json_valid(groups) AND json_type(groups) = 'array'),
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL CHECK (expires_at > created_at),
    id_token TEXT NOT NULL CHECK (length(id_token) > 0)
  ) STRICT;
  CREATE INDEX sessions_expires_at ON sessions (expires_at);
`
