import type { AccessProvider } from '#core/privateAccess.ts'
import type { CredentialContext } from '#server/credentials/credentialContext.ts'
import { openCredential } from '#server/credentials/credentialSecrets.ts'
import { loginOf } from '#server/credentials/credentialLogin.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { runCredentialTest } from '#server/credentials/runCredentialTest.ts'
import {
  getCredentialRow,
  listUsableScopes,
  storeCredentialTest,
} from '#server/db/credentialRepository.ts'
import { toAccessScope, type CredentialRow } from '#server/db/credentialRows.ts'

export type TestCredentialResult =
  | { ok: true; row: CredentialRow }
  | { ok: false; error: 'not_found' | 'secret_unreadable' }

/**
 * Tests a stored credential against the images and repositories it covers and stores the
 * outcome as its last test.
 * @param {CredentialContext} context - Database, clock, fetch and limits
 * @param {CredentialVault} vault - Vault of the configured key
 * @param {number} id - Credential id
 * @returns {Promise<TestCredentialResult>} - Row with the new last test, or why it was not tested
 */
export const testCredential = async (
  context: CredentialContext,
  vault: CredentialVault,
  id: number,
): Promise<TestCredentialResult> => {
  const row = getCredentialRow(context.db, id)

  if (row === null) {
    return { ok: false, error: 'not_found' }
  }

  const secret = openCredential(vault, row)

  if (secret === null) {
    return { ok: false, error: 'secret_unreadable' }
  }

  const result = await runCredentialTest(context.db, {
    scope: toAccessScope(row),
    provider: row.provider as AccessProvider,
    scopes: listUsableScopes(context.db, vault),
    login: loginOf(row.provider as AccessProvider, secret),
    fetch: context.fetch,
    timings: context.timings,
    now: context.clock(),
  })

  storeCredentialTest(context.db, id, result)

  const tested = getCredentialRow(context.db, id)

  return tested === null ? { ok: false, error: 'not_found' } : { ok: true, row: tested }
}
