import { describe, expect, it } from 'vitest'

import { isTokenLive, scopesOf, validateTokenInput } from '#core/apiToken.ts'

const NOW = new Date('2026-06-01T12:00:00.000Z')

describe('validateTokenInput', () => {
  it('accepts a trimmed name, a scope and a future expiry up to 365 days ahead', () => {
    expect(
      validateTokenInput(
        { name: ' laptop ', scope: 'read', expiresAt: '2027-06-01T12:00:00Z' },
        NOW,
      ),
    ).toEqual({
      ok: true,
      value: { name: 'laptop', scope: 'read', expiresAt: '2027-06-01T12:00:00.000Z' },
    })
    expect(
      validateTokenInput({ name: 'x', scope: 'read', expiresAt: '2027-06-01' }, NOW),
    ).toMatchObject({ ok: true })
    expect(
      validateTokenInput({ name: 'ci', scope: 'propose', expiresAt: '2026-08-30' }, NOW),
    ).toEqual({
      ok: true,
      value: { name: 'ci', scope: 'propose', expiresAt: '2026-08-30T23:59:59.999Z' },
    })
  })

  it('rejects blank, long, control-character and non-string names', () => {
    /**
     * Validates a body with the given name.
     * @param {unknown} name - Raw name
     * @returns {unknown} - Validation result
     */
    const errors = (name: unknown): unknown =>
      validateTokenInput({ name, scope: 'read', expiresAt: '2026-07-01' }, NOW)

    expect(errors('  ')).toEqual({ ok: false, errors: [{ field: 'name', code: 'required' }] })
    expect(errors('x'.repeat(65))).toEqual({
      ok: false,
      errors: [{ field: 'name', code: 'too_long' }],
    })
    expect(errors('x'.repeat(64))).toMatchObject({ ok: true })
    expect(errors('lap\ntop')).toEqual({ ok: false, errors: [{ field: 'name', code: 'invalid' }] })
    expect(errors('lap\u0085top')).toMatchObject({ ok: false })
    expect(errors(42)).toEqual({ ok: false, errors: [{ field: 'name', code: 'invalid' }] })
  })

  it('rejects unknown scopes and missing, past or too distant expiries', () => {
    expect(validateTokenInput({ name: 'x', scope: 'write', expiresAt: '2026-07-01' }, NOW)).toEqual(
      {
        ok: false,
        errors: [{ field: 'scope', code: 'invalid' }],
      },
    )
    expect(validateTokenInput({ name: 'x' }, NOW)).toEqual({
      ok: false,
      errors: [
        { field: 'scope', code: 'required' },
        { field: 'expiresAt', code: 'required' },
      ],
    })
    expect(validateTokenInput({ name: 'x', scope: 'read', expiresAt: '2026-05-01' }, NOW)).toEqual({
      ok: false,
      errors: [{ field: 'expiresAt', code: 'in_past' }],
    })
    expect(
      validateTokenInput({ name: 'x', scope: 'read', expiresAt: '2036-01-01' }, NOW),
    ).toMatchObject({ ok: false, errors: [{ field: 'expiresAt', code: 'too_far' }] })
    expect(validateTokenInput({ name: 'x', scope: 'read', expiresAt: null }, NOW)).toEqual({
      ok: false,
      errors: [{ field: 'expiresAt', code: 'required' }],
    })
    expect(validateTokenInput({ name: 'x', scope: 'read', expiresAt: '2027-06-03' }, NOW)).toEqual({
      ok: false,
      errors: [{ field: 'expiresAt', code: 'too_far' }],
    })
    expect(validateTokenInput({ name: 'x', scope: 'read', expiresAt: 'soon' }, NOW)).toMatchObject({
      ok: false,
      errors: [{ field: 'expiresAt', code: 'invalid' }],
    })
  })
})

describe('scopesOf and isTokenLive', () => {
  it('lets propose imply read', () => {
    expect(scopesOf('read')).toEqual(['sieb:read'])
    expect(scopesOf('propose')).toEqual(['sieb:read', 'sieb:propose'])
  })

  it('treats revoked and expired tokens as not live', () => {
    expect(isTokenLive({ revokedAt: null, expiresAt: null }, NOW)).toBe(false)
    expect(isTokenLive({ revokedAt: null, expiresAt: '2026-06-02T00:00:00.000Z' }, NOW)).toBe(true)
    expect(isTokenLive({ revokedAt: null, expiresAt: NOW.toISOString() }, NOW)).toBe(false)
    expect(isTokenLive({ revokedAt: 't', expiresAt: null }, NOW)).toBe(false)
  })
})
