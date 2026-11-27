import type { CredentialWrite } from '#core/credentialInputValidation.ts'
import type { CredentialSecret, CredentialVault } from '#server/credentials/credentialVault.ts'
import { movesSecret } from '#server/credentials/credentialWriteChecks.ts'
import { bindingOf, sealedOf, type CredentialRow } from '#server/db/credentialRows.ts'

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
 * Returns the secret a change seals: the new one, else the stored one. A stored secret of
 * another key must be re-entered, and so must one the write would send to another provider or
 * a new host, since the stored token is write-only and must not reach a host it was not entered for.
 * @param {CredentialVault} vault - Vault of the configured key
 * @param {CredentialRow} row - Stored credential
 * @param {CredentialWrite} write - Validated change
 * @returns {{ ok: true; secret: string } | { ok: false; error: 'secret_required' | 'secret_unreadable' }} - Secret, or why there is none
 */
export const changeSecret = (
  vault: CredentialVault,
  row: CredentialRow,
  write: CredentialWrite,
): { ok: true; secret: string } | { ok: false; error: 'secret_required' | 'secret_unreadable' } => {
  if (write.secret === null && movesSecret(row, write.fields)) {
    return { ok: false, error: 'secret_required' }
  }

  const secret = write.secret ?? openCredential(vault, row)?.secret ?? null

  return secret === null ? { ok: false, error: 'secret_unreadable' } : { ok: true, secret }
}
