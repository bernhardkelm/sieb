/**
 * Schema step 11: mcp_connections holds per sieb user and authentication kind when an
 * authenticated MCP request last arrived, so the UI can tell whether Claude reaches sieb.
 */
export const MIGRATION_11 = `
  CREATE TABLE mcp_connections (
    username TEXT NOT NULL CHECK (length(username) > 0),
    via TEXT NOT NULL CHECK (via IN ('token', 'oauth')),
    last_seen_at TEXT NOT NULL,
    PRIMARY KEY (username, via)
  ) STRICT;
`
