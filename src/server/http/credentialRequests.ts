import type { Context } from 'hono'

import { validateCredentialInput, type CredentialWrite } from '#core/credentialInputValidation.ts'
import type { ErrorBody, ValidationIssue } from '#core/errorApiTypes.ts'
import type { CredentialCandidate } from '#server/credentials/candidateTest.ts'
import { changeSecret } from '#server/credentials/credentialSecrets.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import type { CredentialRow } from '#server/db/credentialRows.ts'
import { inputOf } from '#server/http/credentialResponses.ts'
import { INVALID_BODY } from '#server/http/requestBody.ts'
import { validationFailed } from '#server/http/responses.ts'

/** Values a request asks to store or test, with the secret they would be sealed with */
export interface CandidateRequest {
  write: CredentialWrite
  candidate: CredentialCandidate
  confirmUntested: boolean
}

/**
 * Reads the values of a create, change or dry run: the body alone for a new credential, the
 * body merged over the stored fields for a stored one, and the secret the change would seal,
 * which changeSecret refuses to take from the store for a new provider or host.
 * @param {Context} c - Request context
 * @param {CredentialVault} vault - Vault of the configured key
 * @param {CredentialRow | null} row - Stored credential, null for a new one
 * @param {Record<string, unknown> | null} body - Parsed body, null when it was no JSON object
 * @returns {{ ok: true; value: CandidateRequest } | { ok: false; response: Response }} - Values, or the 400 or 409 answer
 */
export const readCandidate = (
  c: Context,
  vault: CredentialVault,
  row: CredentialRow | null,
  body: Record<string, unknown> | null,
): { ok: true; value: CandidateRequest } | { ok: false; response: Response } => {
  if (body === null) {
    return { ok: false, response: validationFailed(c, INVALID_BODY) }
  }

  const confirm = body.confirmUntested
  const confirmIssues: ValidationIssue[] =
    confirm === undefined || typeof confirm === 'boolean'
      ? []
      : [{ field: 'confirmUntested', code: 'invalid' }]
  const input =
    row === null
      ? validateCredentialInput(body, true)
      : validateCredentialInput({ ...inputOf(row), ...body }, false)

  if (!input.ok || confirmIssues.length > 0) {
    return {
      ok: false,
      response: validationFailed(c, [...(input.ok ? [] : input.errors), ...confirmIssues]),
    }
  }

  const opened =
    row === null
      ? { ok: true as const, secret: input.value.secret ?? '' }
      : changeSecret(vault, row, input.value)

  if (!opened.ok) {
    return { ok: false, response: c.json<ErrorBody>({ error: opened.error }, 409) }
  }

  return {
    ok: true,
    value: {
      write: input.value,
      candidate: { id: row?.id ?? null, fields: input.value.fields, secret: opened.secret },
      confirmUntested: confirm === true,
    },
  }
}
