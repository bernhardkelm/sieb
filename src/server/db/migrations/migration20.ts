/**
 * Schema step 20: access_credentials holds the read credentials Auto-check uses for private
 * images and the source code of own images, one row per credential with its provider, uses,
 * hosts, path prefix and repository mapping in clear and the username and secret sealed with
 * AES-256-GCM under SIEB_CREDENTIALS_KEY (key_id names the key), bound to the row id, provider,
 * hosts and path prefix; the ciphertext starts with a format version byte. checks.source holds the
 * repository the worker checked out as a JSON object { repoUrl, revision, fromLabel }; existing
 * checks keep NULL.
 */
export const MIGRATION_20 = `
  CREATE TABLE access_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab', 'dockerhub')),
    label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 64),
    uses TEXT NOT NULL CHECK (json_valid(uses) AND json_type(uses) = 'array'
      AND json_array_length(uses) BETWEEN 1 AND 2),
    registry_host TEXT CHECK (registry_host IS NULL OR length(registry_host) BETWEEN 1 AND 260),
    git_host TEXT CHECK (git_host IS NULL OR length(git_host) BETWEEN 1 AND 260),
    path_prefix TEXT NOT NULL CHECK (length(path_prefix) <= 200),
    repo_mapping TEXT CHECK (repo_mapping IS NULL
      OR (json_valid(repo_mapping) AND json_type(repo_mapping) = 'object')),
    username TEXT CHECK (username IS NULL OR length(username) BETWEEN 1 AND 200),
    secret_ciphertext BLOB NOT NULL CHECK (typeof(secret_ciphertext) = 'blob'
      AND length(secret_ciphertext) > 16),
    secret_nonce BLOB NOT NULL CHECK (typeof(secret_nonce) = 'blob' AND length(secret_nonce) = 12),
    key_id TEXT NOT NULL CHECK (length(key_id) BETWEEN 1 AND 64),
    created_by TEXT NOT NULL CHECK (length(created_by) >= 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_used_at TEXT,
    last_test TEXT CHECK (last_test IS NULL
      OR (json_valid(last_test) AND json_type(last_test) = 'object')),
    CHECK (registry_host IS NOT NULL OR git_host IS NOT NULL)
  );
  ALTER TABLE checks ADD COLUMN source TEXT
    CHECK (source IS NULL OR (json_valid(source) AND json_type(source) = 'object'));
`
