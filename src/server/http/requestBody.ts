import type { Context } from 'hono'

import type { ValidationIssue } from '#core/errorApiTypes.ts'
import { isPlainObject } from '#core/isPlainObject.ts'
import type { Validation } from '#core/validation.ts'
import { validationFailed } from '#server/http/responses.ts'

/**
 * Reads a JSON object body, an empty body counts as an empty object.
 * @param {Context} c - Request context
 * @returns {Promise<Record<string, unknown> | null>} - Parsed object, null for anything else
 */
export const readObjectBody = async (c: Context): Promise<Record<string, unknown> | null> => {
  const text = await c.req.text()

  if (text.trim() === '') {
    return {}
  }

  try {
    const body: unknown = JSON.parse(text)

    return isPlainObject(body) ? body : null
  } catch {
    return null
  }
}

export const INVALID_BODY: ValidationIssue[] = [{ field: null, code: 'invalid_body' }]

/** A validated request body, or the 400 answer for it */
export type ValidBody<T> = { ok: true; value: T } | { ok: false; response: Response }

/**
 * Reads a JSON object body and validates it, answering 400 with invalid_body for anything that
 * is not a JSON object and with the validation errors otherwise.
 * @param {Context} c - Request context
 * @param {(body: Record<string, unknown>) => Validation<T, ValidationIssue>} validate - Validator of the body
 * @returns {Promise<ValidBody<T>>} - Validated value, or the response to send
 */
export const readValidBody = async <T>(
  c: Context,
  validate: (body: Record<string, unknown>) => Validation<T, ValidationIssue>,
): Promise<ValidBody<T>> => {
  const body = await readObjectBody(c)
  const input = body === null ? null : validate(body)

  if (input === null || !input.ok) {
    return { ok: false, response: validationFailed(c, input?.errors ?? INVALID_BODY) }
  }

  return { ok: true, value: input.value }
}
