import { describe, expect, it } from 'vitest'

import { validateBulkDecisionInput } from '#core/bulkDecisionValidation.ts'
import { WAITING_FOR_MAX_LENGTH } from '#core/decision.ts'
import { mergeUpstream } from '#core/decisionUpstream.ts'
import { validateDecisionInput, validateDecisionPatch } from '#core/decisionValidation.ts'

import { NOW } from './coreBuilders.ts'

const WAITING = {
  status: 'fix_planned',
  upstreamPending: true,
  waitingFor: ' k3s release bundling traefik 3.7.17 ',
  expiresAt: '2026-07-01',
}

/**
 * Validates a new image decision and returns its errors as field:code.
 * @param {Record<string, unknown>} overrides - Fields to set
 * @returns {string[]} - Errors, empty when valid
 */
const errorsOf = (overrides: Record<string, unknown>): string[] => {
  const result = validateDecisionInput(
    { vulnId: 'CVE-1', scope: 'image', imageRef: 'img/a', reason: 'x', ...overrides },
    NOW,
  )

  return result.ok ? [] : result.errors.map(({ field, code }) => `${field}:${code}`)
}

describe('upstream fields of a new decision', () => {
  it('stores waiting for upstream on fix_planned with what it waits for and an expiry', () => {
    expect(
      validateDecisionInput({ ...WAITING, vulnId: 'CVE-1', scope: 'all', reason: 'x' }, NOW),
    ).toMatchObject({
      ok: true,
      value: { upstreamPending: true, waitingFor: 'k3s release bundling traefik 3.7.17' },
    })
    expect(
      validateDecisionInput(
        { vulnId: 'CVE-1', scope: 'all', status: 'fix_planned', reason: 'x' },
        NOW,
      ),
    ).toMatchObject({ ok: true, value: { upstreamPending: false, waitingFor: null } })
  })

  it('refuses it without waitingFor or expiry and on any other status', () => {
    expect(errorsOf({ ...WAITING, waitingFor: undefined })).toEqual(['waitingFor:required'])
    expect(errorsOf({ ...WAITING, waitingFor: '  ' })).toEqual(['waitingFor:required'])
    expect(errorsOf({ ...WAITING, expiresAt: undefined })).toEqual(['expiresAt:required'])
    expect(errorsOf({ ...WAITING, expiresAt: null })).toEqual(['expiresAt:required'])
    expect(errorsOf({ ...WAITING, expiresAt: '2020-01-01' })).toEqual(['expiresAt:in_past'])
    expect(errorsOf({ ...WAITING, status: 'accepted' })).toEqual(['upstreamPending:not_allowed'])
    expect(errorsOf({ status: 'fix_planned', waitingFor: 'k3s 1.33' })).toEqual([
      'waitingFor:not_allowed',
    ])
  })

  it('checks the types and the cap', () => {
    expect(errorsOf({ ...WAITING, upstreamPending: 'yes' })).toEqual(['upstreamPending:invalid'])
    expect(errorsOf({ ...WAITING, waitingFor: 7 })).toEqual(['waitingFor:invalid'])
    expect(errorsOf({ ...WAITING, waitingFor: 'x'.repeat(WAITING_FOR_MAX_LENGTH + 1) })).toEqual([
      'waitingFor:too_long',
    ])
  })

  it('passes them through a bulk decision', () => {
    expect(
      validateBulkDecisionInput(
        { ...WAITING, vulnId: 'CVE-1', imageRefs: ['a'], reason: 'x' },
        NOW,
      ),
    ).toMatchObject({
      ok: true,
      value: { upstreamPending: true, waitingFor: 'k3s release bundling traefik 3.7.17' },
    })
  })
})

describe('upstream fields of a decision change', () => {
  const stored = { upstreamPending: true, waitingFor: 'k3s 1.33' }
  const planned = { status: 'fix_planned' as const, expiresAt: '2026-07-01T23:59:59.000Z' }

  it('reads only the present fields', () => {
    expect(validateDecisionPatch({ upstreamPending: false }, NOW)).toEqual({
      ok: true,
      value: { upstreamPending: false },
    })
    expect(validateDecisionPatch({ waitingFor: ' k3s 1.34 ' }, NOW)).toEqual({
      ok: true,
      value: { waitingFor: 'k3s 1.34' },
    })
    expect(validateDecisionPatch({ upstreamPending: 1 }, NOW)).toMatchObject({
      ok: false,
      errors: [{ field: 'upstreamPending', code: 'invalid' }],
    })
  })

  it('keeps the stored values, clears them when the status leaves fix_planned', () => {
    expect(mergeUpstream(stored, { reason: 'x' }, planned)).toEqual({ ok: true, value: stored })
    expect(mergeUpstream(stored, { waitingFor: 'k3s 1.34' }, planned)).toEqual({
      ok: true,
      value: { upstreamPending: true, waitingFor: 'k3s 1.34' },
    })
    expect(
      mergeUpstream(stored, { status: 'accepted' }, { ...planned, status: 'accepted' }),
    ).toEqual({
      ok: true,
      value: { upstreamPending: false, waitingFor: null },
    })
    expect(mergeUpstream(stored, { upstreamPending: false }, planned)).toEqual({
      ok: true,
      value: { upstreamPending: false, waitingFor: null },
    })
  })

  it('refuses a change that breaks the rules', () => {
    const none = { upstreamPending: false, waitingFor: null }

    expect(mergeUpstream(none, { upstreamPending: true }, planned)).toEqual({
      ok: false,
      issue: { field: 'waitingFor', code: 'required' },
    })
    expect(mergeUpstream(stored, { expiresAt: null }, { ...planned, expiresAt: null })).toEqual({
      ok: false,
      issue: { field: 'expiresAt', code: 'required' },
    })
    expect(
      mergeUpstream(
        none,
        { upstreamPending: true, waitingFor: 'x' },
        { ...planned, status: 'accepted' },
      ),
    ).toEqual({ ok: false, issue: { field: 'upstreamPending', code: 'not_allowed' } })
    expect(mergeUpstream(none, { waitingFor: 'x' }, planned)).toEqual({
      ok: false,
      issue: { field: 'waitingFor', code: 'not_allowed' },
    })
  })
})
