import type { AccessScope } from '#core/accessScope.ts'
import type {
  AccessCredentialView,
  AccessProvider,
  AccessTestResult,
  AccessUse,
  RepoMapping,
} from '#core/privateAccess.ts'
import type { SealedSecret } from '#server/credentials/credentialVault.ts'
import type { SealBinding } from '#server/credentials/sealBinding.ts'

export interface CredentialRow {
  id: number
  provider: string
  label: string
  uses: string
  registry_host: string | null
  git_host: string | null
  path_prefix: string
  repo_mapping: string | null
  username: string | null
  secret_ciphertext: Uint8Array
  secret_nonce: Uint8Array
  key_id: string
  created_by: string
  created_at: string
  updated_at: string
  last_used_at: string | null
  last_test: string | null
}

/**
 * Maps a row to its scope, which decides what the credential covers.
 * @param {CredentialRow} row - Row
 * @returns {AccessScope} - Scope
 */
export const toAccessScope = (row: CredentialRow): AccessScope => ({
  id: row.id,
  label: row.label,
  uses: JSON.parse(row.uses) as AccessUse[],
  registryHost: row.registry_host,
  gitHost: row.git_host,
  pathPrefix: row.path_prefix,
  repoMapping: row.repo_mapping === null ? null : (JSON.parse(row.repo_mapping) as RepoMapping),
})

/**
 * Maps a row to its API view, never with the sealed secret.
 * @param {CredentialRow} row - Row
 * @param {boolean} secretReadable - Whether the configured key opens its secret
 * @returns {AccessCredentialView} - View
 */
export const toCredentialView = (
  row: CredentialRow,
  secretReadable: boolean,
): AccessCredentialView => ({
  ...toAccessScope(row),
  provider: row.provider as AccessProvider,
  username: row.username,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastUsedAt: row.last_used_at,
  lastTest: row.last_test === null ? null : (JSON.parse(row.last_test) as AccessTestResult),
  secretReadable,
})

/**
 * Returns the sealed username and secret of a row.
 * @param {CredentialRow} row - Row
 * @returns {SealedSecret} - Sealed secret
 */
export const sealedOf = (row: CredentialRow): SealedSecret => ({
  ciphertext: Buffer.from(row.secret_ciphertext),
  nonce: Buffer.from(row.secret_nonce),
  keyId: row.key_id,
})

/**
 * Returns what the sealed secret of a row is bound to.
 * @param {CredentialRow} row - Row
 * @returns {SealBinding} - Id, provider, hosts and path prefix as stored
 */
export const bindingOf = (row: CredentialRow): SealBinding => ({
  id: row.id,
  provider: row.provider,
  registryHost: row.registry_host,
  gitHost: row.git_host,
  pathPrefix: row.path_prefix,
})
