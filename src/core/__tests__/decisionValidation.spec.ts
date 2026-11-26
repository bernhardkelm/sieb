import { describe, expect, it } from 'vitest'

import { validateDecisionInput, validateDecisionPatch } from '#core/decisionValidation.ts'

import { NOW } from './coreBuilders.ts'

const VALID = {
  vulnId: 'CVE-2025-1000',
  scope: 'image',
  imageRef: 'index.docker.io/library/nginx',
  status: 'accepted',
  reason: '  behind auth  ',
}

describe('validateDecisionInput', () => {
  it('trims the reason and applies the default expiry', () => {
    expect(validateDecisionInput(VALID, NOW)).toEqual({
      ok: true,
      value: { ...VALID, reason: 'behind auth', expiresAt: '2026-08-30T12:00:00.000Z' },
    })
  })

  it('keeps an explicit null expiry and normalises a given one to UTC', () => {
    expect(validateDecisionInput({ ...VALID, expiresAt: null }, NOW)).toMatchObject({
      ok: true,
      value: { expiresAt: null },
    })
    expect(
      validateDecisionInput({ ...VALID, expiresAt: '2026-07-01T02:00:00+02:00' }, NOW),
    ).toMatchObject({ ok: true, value: { expiresAt: '2026-07-01T00:00:00.000Z' } })
  })

  it('reports every invalid field', () => {
    const result = validateDecisionInput(
      { vulnId: ' ', scope: 'cluster', status: 'ignored', reason: '', expiresAt: 'soon' },
      NOW,
    )

    expect(result).toEqual({
      ok: false,
      errors: [
        { field: 'scope', code: 'invalid' },
        { field: 'status', code: 'invalid' },
        { field: 'expiresAt', code: 'invalid' },
        { field: 'vulnId', code: 'required' },
        { field: 'reason', code: 'required' },
      ],
    })
  })

  it('rejects an expiry in the past and checks image_ref against the scope', () => {
    expect(validateDecisionInput({ ...VALID, expiresAt: '2026-06-01T11:00:00Z' }, NOW)).toEqual({
      ok: false,
      errors: [{ field: 'expiresAt', code: 'in_past' }],
    })
    expect(validateDecisionInput({ ...VALID, imageRef: undefined }, NOW)).toEqual({
      ok: false,
      errors: [{ field: 'imageRef', code: 'required' }],
    })
    expect(validateDecisionInput({ ...VALID, scope: 'all' }, NOW)).toEqual({
      ok: false,
      errors: [{ field: 'imageRef', code: 'not_allowed' }],
    })
  })

  it('accepts only expiries with Z or an offset, a date as end of that day in UTC', () => {
    const expiry = (expiresAt: string): unknown =>
      validateDecisionInput({ ...VALID, expiresAt }, NOW)

    expect(expiry('2026-07-01')).toMatchObject({
      ok: true,
      value: { expiresAt: '2026-07-01T23:59:59.999Z' },
    })
    expect(expiry('2026-07-01T10:00Z')).toMatchObject({
      ok: true,
      value: { expiresAt: '2026-07-01T10:00:00.000Z' },
    })

    for (const value of [
      '2026-07-01T10:00:00',
      '2026-02-30',
      '2026-07-01T10:00:00+0200',
      'July 1',
    ]) {
      expect(expiry(value)).toEqual({
        ok: false,
        errors: [{ field: 'expiresAt', code: 'invalid' }],
      })
    }
  })

  it('caps the expiry at three years and the reason length', () => {
    expect(validateDecisionInput({ ...VALID, expiresAt: '2029-07-01T00:00:00Z' }, NOW)).toEqual({
      ok: false,
      errors: [{ field: 'expiresAt', code: 'too_far' }],
    })
    expect(validateDecisionInput({ ...VALID, expiresAt: '2029-05-01T00:00:00Z' }, NOW).ok).toBe(
      true,
    )
    expect(validateDecisionInput({ ...VALID, reason: 'x'.repeat(2001) }, NOW)).toEqual({
      ok: false,
      errors: [{ field: 'reason', code: 'too_long' }],
    })
  })

  it('accepts scope all without image_ref', () => {
    const { imageRef: _imageRef, ...rest } = VALID

    expect(
      validateDecisionInput({ ...rest, scope: 'all', status: 'not_affected' }, NOW),
    ).toMatchObject({
      ok: true,
      value: { scope: 'all', imageRef: null, expiresAt: null },
    })
  })
})

describe('validateDecisionPatch', () => {
  it('keeps the given fields only', () => {
    expect(validateDecisionPatch({ reason: ' x ', expiresAt: null }, NOW)).toEqual({
      ok: true,
      value: { reason: 'x', expiresAt: null },
    })
  })

  it('rejects empty patches and blank reasons', () => {
    expect(validateDecisionPatch({}, NOW)).toEqual({
      ok: false,
      errors: [{ field: null, code: 'empty_patch' }],
    })
    expect(validateDecisionPatch({ reason: ' ', status: 'nope' }, NOW)).toEqual({
      ok: false,
      errors: [
        { field: 'status', code: 'invalid' },
        { field: 'reason', code: 'required' },
      ],
    })
  })

  it('carries reconfirm only when true and rejects non-boolean values', () => {
    expect(validateDecisionPatch({ reconfirm: true }, NOW)).toEqual({
      ok: true,
      value: { reconfirm: true },
    })
    expect(validateDecisionPatch({ reconfirm: false }, NOW)).toEqual({
      ok: false,
      errors: [{ field: null, code: 'empty_patch' }],
    })
    expect(validateDecisionPatch({ reconfirm: 'yes', reason: 'x' }, NOW)).toEqual({
      ok: false,
      errors: [{ field: 'reconfirm', code: 'invalid' }],
    })
    expect(validateDecisionPatch({ reason: 'x'.repeat(2001) }, NOW)).toEqual({
      ok: false,
      errors: [{ field: 'reason', code: 'too_long' }],
    })
  })
})
