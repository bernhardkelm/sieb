import type { DatabaseSync } from 'node:sqlite'

import type { CredentialWrite } from '#core/credentialInputValidation.ts'
import type { AccessTestResult } from '#core/privateAccess.ts'
import { changeSecret } from '#server/credentials/credentialSecrets.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { collides, createRefusal } from '#server/credentials/credentialWriteChecks.ts'
import { fieldsBinding } from '#server/credentials/sealBinding.ts'
import {
  deleteCredentialRow,
  getCredentialRow,
  insertCredentialRow,
  nextCredentialId,
  storeCredentialTest,
  updateCredentialRow,
} from '#server/db/credentialRepository.ts'
import type { CredentialRow } from '#server/db/credentialRows.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

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
 * Stores a new credential with the test it passed, sealed bound to its id, provider, hosts and
 * path prefix, unless MAX_CREDENTIALS are stored or another one claims the same scope.
 * @param {DatabaseSync} db - Open database
 * @param {CredentialVault} vault - Vault of the configured key
 * @param {{ write: CredentialWrite; actor: string; lastTest: AccessTestResult | null }} input - Validated write with its secret, the creating user and the test it passed
 * @param {Date} now - Creation time
 * @returns {CredentialCommandResult} - Stored row, or why not
 */
export const createCredential = (
  db: DatabaseSync,
  vault: CredentialVault,
  {
    write,
    actor,
    lastTest,
  }: { write: CredentialWrite; actor: string; lastTest: AccessTestResult | null },
  now: Date,
): CredentialCommandResult =>
  inTransaction(db, (): CredentialCommandResult => {
    const id = nextCredentialId(db)
    const refusal = createRefusal(db, write.fields)

    if (refusal !== null) {
      return { ok: false, error: refusal }
    }

    const sealed = vault.seal(fieldsBinding(id, write.fields), {
      username: write.fields.username,
      secret: write.secret ?? '',
    })

    insertCredentialRow(db, { id, fields: write.fields, sealed, createdBy: actor }, now)

    if (lastTest !== null) {
      storeCredentialTest(db, id, lastTest)
    }

    const row = getCredentialRow(db, id)

    return row === null ? { ok: false, error: 'not_found' } : { ok: true, row }
  })

/**
 * Replaces the fields of a credential and seals its username with the secret of changeSecret,
 * bound to the new fields, and stores the test the change passed; without one the last test stays.
 * @param {DatabaseSync} db - Open database
 * @param {CredentialVault} vault - Vault of the configured key
 * @param {{ id: number; write: CredentialWrite; lastTest?: AccessTestResult }} input - Credential id, validated write and the test it passed
 * @param {Date} now - Update time
 * @returns {CredentialCommandResult} - Updated row, or why not
 */
export const updateCredential = (
  db: DatabaseSync,
  vault: CredentialVault,
  { id, write, lastTest }: { id: number; write: CredentialWrite; lastTest?: AccessTestResult },
  now: Date,
): CredentialCommandResult =>
  inTransaction(db, (): CredentialCommandResult => {
    const current = getCredentialRow(db, id)

    if (current === null) {
      return { ok: false, error: 'not_found' }
    }

    const opened = changeSecret(vault, current, write)

    if (!opened.ok) {
      return opened
    }

    if (collides(db, write.fields, id)) {
      return { ok: false, error: 'duplicate_scope' }
    }

    const sealed = vault.seal(fieldsBinding(id, write.fields), {
      username: write.fields.username,
      secret: opened.secret,
    })

    updateCredentialRow(db, { id, fields: write.fields, sealed }, now)

    if (lastTest !== undefined) {
      storeCredentialTest(db, id, lastTest)
    }

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
