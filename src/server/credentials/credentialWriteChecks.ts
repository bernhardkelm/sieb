import type { DatabaseSync } from 'node:sqlite'

import { scopesCollide, type AccessScope } from '#core/accessScope.ts'
import type { CredentialFields, CredentialWrite } from '#core/credentialInputValidation.ts'
import {
  countCredentials,
  listCredentialRows,
  nextCredentialId,
} from '#server/db/credentialRepository.ts'
import { toAccessScope, type CredentialRow } from '#server/db/credentialRows.ts'

export const MAX_CREDENTIALS = 50

/**
 * Returns whether another stored credential claims the same host and prefix for a shared use.
 * @param {DatabaseSync} db - Open database
 * @param {CredentialFields} fields - Fields of the written credential
 * @param {number} id - Id of the written credential
 * @returns {boolean} - True on a collision
 */
export const collides = (db: DatabaseSync, fields: CredentialFields, id: number): boolean => {
  const candidate: AccessScope = { ...fields, id }

  return listCredentialRows(db)
    .filter((row) => row.id !== id)
    .some((row) => scopesCollide(toAccessScope(row), candidate))
}

/**
 * Returns why a new credential cannot be stored: MAX_CREDENTIALS are stored, or another one
 * claims the same scope. Checked before its test and again in the transaction that stores it.
 * @param {DatabaseSync} db - Open database
 * @param {CredentialFields} fields - Fields of the new credential
 * @returns {'too_many_credentials' | 'duplicate_scope' | null} - Refusal, null when it may be stored
 */
export const createRefusal = (
  db: DatabaseSync,
  fields: CredentialFields,
): 'too_many_credentials' | 'duplicate_scope' | null => {
  if (countCredentials(db) >= MAX_CREDENTIALS) {
    return 'too_many_credentials'
  }

  return collides(db, fields, nextCredentialId(db)) ? 'duplicate_scope' : null
}

/**
 * Returns whether a write sends the stored secret somewhere new: another provider, or a
 * registry or git host the credential did not have. Removing a host sends it nowhere new.
 * @param {CredentialRow} row - Stored credential
 * @param {CredentialFields} fields - Fields of the write
 * @returns {boolean} - True when the write needs the secret entered again
 */
export const movesSecret = (row: CredentialRow, fields: CredentialFields): boolean =>
  row.provider !== fields.provider ||
  (fields.registryHost !== null && fields.registryHost !== row.registry_host) ||
  (fields.gitHost !== null && fields.gitHost !== row.git_host)

const RETESTED_FIELDS = [
  'provider',
  'uses',
  'registryHost',
  'gitHost',
  'pathPrefix',
  'repoMapping',
  'username',
] as const

/**
 * Returns whether a change must pass a test before it is stored: a new secret, or any field
 * but the label, all of which change what the credential reaches or how it logs in.
 * @param {CredentialRow} row - Stored credential
 * @param {CredentialWrite} write - Validated change merged over the stored fields
 * @returns {boolean} - True unless only the label changes
 */
export const needsRetest = (row: CredentialRow, write: CredentialWrite): boolean => {
  const stored = { ...toAccessScope(row), provider: row.provider, username: row.username }

  return (
    write.secret !== null ||
    RETESTED_FIELDS.some(
      (field) => JSON.stringify(stored[field]) !== JSON.stringify(write.fields[field]),
    )
  )
}
