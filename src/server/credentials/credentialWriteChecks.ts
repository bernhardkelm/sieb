import type { DatabaseSync } from 'node:sqlite'

import { scopesCollide, type AccessScope } from '#core/accessScope.ts'
import type { CredentialFields } from '#core/credentialInputValidation.ts'
import { listCredentialRows } from '#server/db/credentialRepository.ts'
import { toAccessScope, type CredentialRow } from '#server/db/credentialRows.ts'

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
