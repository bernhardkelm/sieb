import type { AccessTestResult } from '#core/privateAccess.ts'
import type { CredentialRow } from '#server/db/credentialRows.ts'
import { logSafe } from '#server/logSafe.ts'

/**
 * Formats the log line of a credential change, with its scope but never its username or secret.
 * @param {string} change - What happened, e.g. created, updated, deleted, tested
 * @param {CredentialRow} row - Credential
 * @param {string} actor - Acting user
 * @returns {string} - Log line
 */
export const credentialLogLine = (change: string, row: CredentialRow, actor: string): string =>
  `[sieb] access credential ${change}: by=${JSON.stringify(logSafe(actor))} id=${row.id} ` +
  `provider=${row.provider} label=${JSON.stringify(logSafe(row.label))} ` +
  `registry=${row.registry_host ?? '-'} git=${row.git_host ?? '-'} ` +
  `prefix=${JSON.stringify(row.path_prefix)}`

/**
 * Summarises a credential test for its log line as ok/checked per use.
 * @param {AccessTestResult | null} result - Test outcome
 * @returns {string} - For example "registry=3/4 git=1/1", '' without a result
 */
export const testSummary = (result: AccessTestResult | null): string =>
  (['registry', 'git'] as const)
    .flatMap((use) => {
      const part = result?.[use] ?? null

      return part === null ? [] : [`${use}=${part.ok}/${part.checked}`]
    })
    .join(' ')
