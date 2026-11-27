import type { DatabaseSync } from 'node:sqlite'

import type { CredentialWrite } from '#core/credentialInputValidation.ts'
import type { CredentialSecret, CredentialVault } from '#server/credentials/credentialVault.ts'
import { collides, movesSecret } from '#server/credentials/credentialWriteChecks.ts'
import { fieldsBinding } from '#server/credentials/sealBinding.ts'
import {
  countCredentials,
  deleteCredentialRow,
  getCredentialRow,
  insertCredentialRow,
  nextCredentialId,
  updateCredentialRow,
} from '#server/db/credentialRepository.ts'
import { bindingOf, sealedOf, type CredentialRow } from '#server/db/credentialRows.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

export const MAX_CREDENTIALS = 50

export type CredentialCommandError =
  | 'not_found'
  | 'too_many_credentials'
  | 'duplicate_scope'
  | 'secret_unreadable'
  | 'secret_required'

export type CredentialCommandResult =
  | { ok: true; row: CredentialRow }
  | { ok: false; error: CredentialCommandError }

/**
 * Opens the username and secret of a stored credential.
 * @param {CredentialVault} vault - Vault of the configured key
 * @param {CredentialRow} row - Row
 * @returns {CredentialSecret | null} - Username and secret, null when sealed with another key, or when the ciphertext, id, provider, a host or the path prefix was changed outside sieb
 */
export const openCredential = (
  vault: CredentialVault,
  row: CredentialRow,
): CredentialSecret | null => vault.open(bindingOf(row), sealedOf(row))

/**
 * Returns whether the configured key opens the secret of a row.
 * @param {CredentialVault | null} vault - Vault of the configured key, null without one
 * @param {CredentialRow} row - Row
 * @returns {boolean} - True when the secret can be handed out
 */
export const secretReadable = (vault: CredentialVault | null, row: CredentialRow): boolean =>
  vault !== null && openCredential(vault, row) !== null

/**
 * Stores a new credential, sealed bound to its id, provider, hosts and path prefix, unless MAX_CREDENTIALS are stored or
 * another one claims the same scope.
 * @param {DatabaseSync} db - Open database
 * @param {CredentialVault} vault - Vault of the configured key
 * @param {{ write: CredentialWrite; actor: string }} input - Validated write with its secret and the creating user
 * @param {Date} now - Creation time
 * @returns {CredentialCommandResult} - Stored row, or why not
 */
export const createCredential = (
  db: DatabaseSync,
  vault: CredentialVault,
  { write, actor }: { write: CredentialWrite; actor: string },
  now: Date,
): CredentialCommandResult =>
  inTransaction(db, (): CredentialCommandResult => {
    const id = nextCredentialId(db)

    if (countCredentials(db) >= MAX_CREDENTIALS) {
      return { ok: false, error: 'too_many_credentials' }
    }

    if (collides(db, write.fields, id)) {
      return { ok: false, error: 'duplicate_scope' }
    }

    const sealed = vault.seal(fieldsBinding(id, write.fields), {
      username: write.fields.username,
      secret: write.secret ?? '',
    })

    insertCredentialRow(db, { id, fields: write.fields, sealed, createdBy: actor }, now)

    const row = getCredentialRow(db, id)

    return row === null ? { ok: false, error: 'not_found' } : { ok: true, row }
  })

/**
 * Replaces the fields of a credential and seals its username with the new secret, or with the
 * stored one when the write carries none, bound to the new fields; a stored secret of another key must be re-entered,
 * and so must one the write would send to another provider or a new host, since the stored
 * token is write-only and must not reach a host it was not entered for.
 * @param {DatabaseSync} db - Open database
 * @param {CredentialVault} vault - Vault of the configured key
 * @param {{ id: number; write: CredentialWrite }} input - Credential id and validated write
 * @param {Date} now - Update time
 * @returns {CredentialCommandResult} - Updated row, or why not
 */
export const updateCredential = (
  db: DatabaseSync,
  vault: CredentialVault,
  { id, write }: { id: number; write: CredentialWrite },
  now: Date,
): CredentialCommandResult =>
  inTransaction(db, (): CredentialCommandResult => {
    const current = getCredentialRow(db, id)

    if (current === null) {
      return { ok: false, error: 'not_found' }
    }

    if (write.secret === null && movesSecret(current, write.fields)) {
      return { ok: false, error: 'secret_required' }
    }

    const secret = write.secret ?? openCredential(vault, current)?.secret ?? null

    if (secret === null) {
      return { ok: false, error: 'secret_unreadable' }
    }

    if (collides(db, write.fields, id)) {
      return { ok: false, error: 'duplicate_scope' }
    }

    const sealed = vault.seal(fieldsBinding(id, write.fields), {
      username: write.fields.username,
      secret,
    })

    updateCredentialRow(db, { id, fields: write.fields, sealed }, now)

    const row = getCredentialRow(db, id)

    return row === null ? { ok: false, error: 'not_found' } : { ok: true, row }
  })

/**
 * Deletes a credential.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Credential id
 * @returns {CredentialRow | null} - Deleted row, null when unknown
 */
export const deleteCredential = (db: DatabaseSync, id: number): CredentialRow | null =>
  inTransaction(db, () => {
    const row = getCredentialRow(db, id)

    return row !== null && deleteCredentialRow(db, id) ? row : null
  })
