import type { AccessScope } from '#core/accessScope.ts'
import type { AccessProvider } from '#core/privateAccess.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import { expireAndLog } from '#server/checks/readChecks.ts'
import { openCredential } from '#server/credentials/credentialSecrets.ts'
import { loginOf, type CredentialLogin } from '#server/credentials/credentialLogin.ts'
import { getCheck } from '#server/db/checkRepository.ts'
import type { StoredCheck } from '#server/db/checkRows.ts'
import { getCredentialRow, touchCredential } from '#server/db/credentialRepository.ts'

export type FetcherRefusal = 'not_found' | 'not_running' | 'not_claimed' | 'not_pullable'

export type FetcherResult<T> = { ok: true; value: T } | { ok: false; error: FetcherRefusal }

/**
 * Reads the running check a fetcher request is about, after failing timed out checks.
 * @param {CheckContext} context - Check context
 * @param {number} id - Check id
 * @returns {StoredCheck | FetcherRefusal} - Running check, or why there is none
 */
export const runningCheck = (context: CheckContext, id: number): StoredCheck | FetcherRefusal => {
  expireAndLog(context)

  const check = getCheck(context.db, id)

  if (check === null) {
    return 'not_found'
  }

  return check.state === 'running' ? check : 'not_running'
}

/**
 * Opens the login of a credential and records its use.
 * @param {CheckContext} context - Check context with a vault
 * @param {AccessScope} scope - Credential to hand out
 * @param {{ checkId: number; target: string }} use - Check and target for the log line
 * @returns {CredentialLogin | null} - Login, null when the row is gone or cannot be opened
 */
export const handOut = (
  context: CheckContext,
  scope: AccessScope,
  { checkId, target }: { checkId: number; target: string },
): CredentialLogin | null => {
  const row = getCredentialRow(context.db, scope.id)
  const secret =
    row === null || context.privateVault === null ? null : openCredential(context.privateVault, row)

  if (row === null || secret === null) {
    context.log(`[sieb] check ${checkId}: credential ${scope.id} could not be opened for ${target}`)
    return null
  }

  touchCredential(context.db, row.id, context.clock())
  context.log(`[sieb] check ${checkId}: credential ${row.id} handed to the fetcher for ${target}`)
  return loginOf(row.provider as AccessProvider, secret)
}
