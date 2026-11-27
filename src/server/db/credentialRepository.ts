import type { DatabaseSync } from 'node:sqlite'

import type { AccessScope } from '#core/accessScope.ts'
import type { CredentialFields } from '#core/credentialInputValidation.ts'
import type { AccessTestResult } from '#core/privateAccess.ts'
import type { CredentialVault, SealedSecret } from '#server/credentials/credentialVault.ts'
import {
  bindingOf,
  sealedOf,
  toAccessScope,
  type CredentialRow,
} from '#server/db/credentialRows.ts'

/**
 * Lists every stored credential, oldest first.
 * @param {DatabaseSync} db - Open database
 * @returns {CredentialRow[]} - Rows
 */
export const listCredentialRows = (db: DatabaseSync): CredentialRow[] =>
  db.prepare('SELECT * FROM access_credentials ORDER BY id').all() as unknown as CredentialRow[]

/**
 * Reads one stored credential.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Credential id
 * @returns {CredentialRow | null} - Row, null when unknown
 */
export const getCredentialRow = (db: DatabaseSync, id: number): CredentialRow | null =>
  (db.prepare('SELECT * FROM access_credentials WHERE id = ?').get(id) as
    | CredentialRow
    | undefined) ?? null

/**
 * Lists the scopes of the credentials whose secret the configured key opens; rows of an earlier
 * key, and rows whose ciphertext or bound fields were changed outside sieb, cover nothing.
 * @param {DatabaseSync} db - Open database
 * @param {CredentialVault | null} vault - Vault of the configured key, null while private access is off
 * @returns {AccessScope[]} - Usable scopes, empty without a vault
 */
export const listUsableScopes = (db: DatabaseSync, vault: CredentialVault | null): AccessScope[] =>
  vault === null
    ? []
    : (
        db
          .prepare('SELECT * FROM access_credentials WHERE key_id = ? ORDER BY id')
          .all(vault.keyId) as unknown as CredentialRow[]
      )
        .filter((row) => vault.open(bindingOf(row), sealedOf(row)) !== null)
        .map(toAccessScope)

/**
 * Returns the id the next insert gets, so the secret can be sealed bound to it before the row exists.
 * Call it inside the transaction of the insert.
 * @param {DatabaseSync} db - Open database
 * @returns {number} - Next id, above every id ever handed out
 */
export const nextCredentialId = (db: DatabaseSync): number => {
  const sequence = db
    .prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'access_credentials'`)
    .get() as { seq: number } | undefined
  const highest = db.prepare('SELECT MAX(id) AS id FROM access_credentials').get() as {
    id: number | null
  }

  return Math.max(sequence?.seq ?? 0, highest.id ?? 0) + 1
}

/**
 * Lists the column values of the stored fields.
 * @param {CredentialFields} fields - Validated fields
 * @returns {(string | null)[]} - provider, label, uses, registry_host, git_host, path_prefix, repo_mapping, username
 */
const fieldValues = (fields: CredentialFields): (string | null)[] => [
  fields.provider,
  fields.label,
  JSON.stringify(fields.uses),
  fields.registryHost,
  fields.gitHost,
  fields.pathPrefix,
  fields.repoMapping === null ? null : JSON.stringify(fields.repoMapping),
  fields.username,
]

/**
 * Inserts a credential with a given id and its sealed secret.
 * @param {DatabaseSync} db - Open database
 * @param {{ id: number; fields: CredentialFields; sealed: SealedSecret; createdBy: string }} row - Id from nextCredentialId, fields, sealed secret and creator
 * @param {Date} now - Creation time
 * @returns {void}
 */
export const insertCredentialRow = (
  db: DatabaseSync,
  {
    id,
    fields,
    sealed,
    createdBy,
  }: { id: number; fields: CredentialFields; sealed: SealedSecret; createdBy: string },
  now: Date,
): void => {
  const at = now.toISOString()

  db.prepare(
    `INSERT INTO access_credentials (id, provider, label, uses, registry_host, git_host, path_prefix,
       repo_mapping, username, secret_ciphertext, secret_nonce, key_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    ...fieldValues(fields),
    sealed.ciphertext,
    sealed.nonce,
    sealed.keyId,
    createdBy,
    at,
    at,
  )
}

/**
 * Replaces the fields of a credential and its sealed secret and drops the last test, which no
 * longer describes it.
 * @param {DatabaseSync} db - Open database
 * @param {{ id: number; fields: CredentialFields; sealed: SealedSecret }} row - Id, fields and sealed secret
 * @param {Date} now - Update time
 * @returns {void}
 */
export const updateCredentialRow = (
  db: DatabaseSync,
  { id, fields, sealed }: { id: number; fields: CredentialFields; sealed: SealedSecret },
  now: Date,
): void => {
  db.prepare(
    `UPDATE access_credentials SET provider = ?, label = ?, uses = ?, registry_host = ?, git_host = ?,
       path_prefix = ?, repo_mapping = ?, username = ?, secret_ciphertext = ?, secret_nonce = ?,
       key_id = ?, updated_at = ?, last_test = NULL
     WHERE id = ?`,
  ).run(
    ...fieldValues(fields),
    sealed.ciphertext,
    sealed.nonce,
    sealed.keyId,
    now.toISOString(),
    id,
  )
}

/**
 * Deletes a credential.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Credential id
 * @returns {boolean} - True when a row was deleted
 */
export const deleteCredentialRow = (db: DatabaseSync, id: number): boolean =>
  db.prepare('DELETE FROM access_credentials WHERE id = ?').run(id).changes > 0

/**
 * Counts the stored credentials.
 * @param {DatabaseSync} db - Open database
 * @returns {number} - Rows
 */
export const countCredentials = (db: DatabaseSync): number =>
  Number((db.prepare('SELECT COUNT(*) AS n FROM access_credentials').get() as { n: number }).n)

/**
 * Records that a credential was handed to the fetcher.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Credential id
 * @param {Date} now - Use time
 * @returns {void}
 */
export const touchCredential = (db: DatabaseSync, id: number, now: Date): void => {
  db.prepare('UPDATE access_credentials SET last_used_at = ? WHERE id = ?').run(
    now.toISOString(),
    id,
  )
}

/**
 * Stores the outcome of a credential test.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Credential id
 * @param {AccessTestResult} result - Test outcome
 * @returns {void}
 */
export const storeCredentialTest = (
  db: DatabaseSync,
  id: number,
  result: AccessTestResult,
): void => {
  db.prepare('UPDATE access_credentials SET last_test = ? WHERE id = ?').run(
    JSON.stringify(result),
    id,
  )
}
