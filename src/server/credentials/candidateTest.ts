import type { AccessScope } from '#core/accessScope.ts'
import type { CredentialFields } from '#core/credentialInputValidation.ts'
import type { AccessTestResult } from '#core/privateAccess.ts'
import type { CredentialContext } from '#server/credentials/credentialContext.ts'
import { loginOf } from '#server/credentials/credentialLogin.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { runCredentialTest } from '#server/credentials/runCredentialTest.ts'
import { listUsableScopes, nextCredentialId } from '#server/db/credentialRepository.ts'

/** Credential values to test, stored or not; the secret stays in memory */
export interface CredentialCandidate {
  id: number | null // stored credential the values replace, null for a new one
  fields: CredentialFields
  secret: string
}

/**
 * Tests credential values against what sieb knows they cover, as if they were stored: their
 * repository mapping replaces the stored one of the same credential. Nothing is written.
 * @param {CredentialContext} context - Database, clock, fetch and limits
 * @param {CredentialVault} vault - Vault of the configured key, for the other credentials' mappings
 * @param {CredentialCandidate} candidate - Values and secret to test
 * @returns {Promise<AccessTestResult>} - Outcome per use
 */
export const testCandidate = (
  context: CredentialContext,
  vault: CredentialVault,
  { id, fields, secret }: CredentialCandidate,
): Promise<AccessTestResult> => {
  const scope: AccessScope = { ...fields, id: id ?? nextCredentialId(context.db) }

  return runCredentialTest(context.db, {
    scope,
    provider: fields.provider,
    scopes: [
      ...listUsableScopes(context.db, vault).filter((other) => other.id !== scope.id),
      scope,
    ],
    login: loginOf(fields.provider, { username: fields.username, secret }),
    fetch: context.fetch,
    timings: context.timings,
    now: context.clock(),
  })
}
