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
      value: {
        ...VALID,
        justification: null,
        reason: 'behind auth',
        expiresAt: '2026-08-30T12:00:00.000Z',
      },
    })
  })

  it('takes a justification only with status not_affected', () => {
    const notAffected = { ...VALID, status: 'not_affected' }

    expect(
      validateDecisionInput({ ...notAffected, justification: 'component_not_present' }, NOW),
    ).toMatchObject({ ok: true, value: { justification: 'component_not_present' } })
    expect(validateDecisionInput({ ...notAffected, justification: null }, NOW)).toMatchObject({
      ok: true,
      value: { justification: null },
    })

    for (const status of ['accepted', 'fix_planned']) {
      expect(
        validateDecisionInput({ ...VALID, status, justification: 'component_not_present' }, NOW),
      ).toEqual({ ok: false, errors: [{ field: 'justification', code: 'not_allowed' }] })
    }

    for (const justification of ['false_positive', '', 3]) {
      expect(validateDecisionInput({ ...notAffected, justification }, NOW)).toEqual({
        ok: false,
        errors: [{ field: 'justification', code: 'invalid' }],
      })
    }
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
  it('takes a justification with not_affected or without status, null clears it', () => {
    expect(
      validateDecisionPatch(
        { status: 'not_affected', justification: 'inline_mitigations_already_exist' },
        NOW,
      ),
    ).toEqual({
      ok: true,
      value: { status: 'not_affected', justification: 'inline_mitigations_already_exist' },
    })
    expect(validateDecisionPatch({ justification: 'vulnerable_code_not_present' }, NOW)).toEqual({
      ok: true,
      value: { justification: 'vulnerable_code_not_present' },
    })
    expect(validateDecisionPatch({ justification: null }, NOW)).toEqual({
      ok: true,
      value: { justification: null },
    })
    expect(validateDecisionPatch({ status: 'accepted', justification: null }, NOW)).toEqual({
      ok: true,
      value: { status: 'accepted', justification: null },
    })
  })

  it('rejects a justification with another status and unknown justifications', () => {
    expect(
      validateDecisionPatch({ status: 'fix_planned', justification: 'component_not_present' }, NOW),
    ).toEqual({ ok: false, errors: [{ field: 'justification', code: 'not_allowed' }] })
    expect(validateDecisionPatch({ justification: 'nope' }, NOW)).toEqual({
      ok: false,
      errors: [{ field: 'justification', code: 'invalid' }],
    })
  })

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
