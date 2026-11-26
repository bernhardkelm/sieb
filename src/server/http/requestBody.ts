import type { Context } from 'hono'

import type { ValidationIssue } from '#core/apiTypes.ts'

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

    return body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export const INVALID_BODY: ValidationIssue[] = [{ field: null, code: 'invalid_body' }]
