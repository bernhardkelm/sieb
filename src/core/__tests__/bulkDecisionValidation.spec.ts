import { describe, expect, it } from 'vitest'

import { validateBulkDecisionInput } from '#core/bulkDecisionValidation.ts'

import { NOW } from './coreBuilders.ts'

describe('validateBulkDecisionInput', () => {
  it('accepts a deduplicated image list with the default expiry of the status', () => {
    expect(
      validateBulkDecisionInput(
        { vulnId: 'CVE-1', imageRefs: ['a', ' a ', 'b'], status: 'accepted', reason: ' ok ' },
        NOW,
      ),
    ).toEqual({
      ok: true,
      value: {
        vulnId: 'CVE-1',
        imageRefs: ['a', 'b'],
        status: 'accepted',
        justification: null,
        reason: 'ok',
        expiresAt: '2026-08-30T12:00:00.000Z',
        upstreamPending: false,
        waitingFor: null,
      },
    })
  })

  it('accepts all-open and collects errors of fields and images', () => {
    expect(
      validateBulkDecisionInput(
        { vulnId: 'CVE-1', imageRefs: 'all-open', status: 'not_affected', reason: 'x' },
        NOW,
      ),
    ).toMatchObject({ ok: true, value: { imageRefs: 'all-open', expiresAt: null } })
    expect(validateBulkDecisionInput({ vulnId: 'CVE-1', status: 'nope', reason: '' }, NOW)).toEqual(
      {
        ok: false,
        errors: [
          { field: 'status', code: 'invalid' },
          { field: 'reason', code: 'required' },
          { field: 'imageRefs', code: 'required' },
        ],
      },
    )
  })

  it('carries a not_affected justification and rejects one with another status', () => {
    const base = { vulnId: 'CVE-1', imageRefs: 'all-open', reason: 'x' }

    expect(
      validateBulkDecisionInput(
        { ...base, status: 'not_affected', justification: 'vulnerable_code_not_in_execute_path' },
        NOW,
      ),
    ).toMatchObject({
      ok: true,
      value: { justification: 'vulnerable_code_not_in_execute_path' },
    })
    expect(
      validateBulkDecisionInput(
        { ...base, status: 'accepted', justification: 'component_not_present' },
        NOW,
      ),
    ).toEqual({ ok: false, errors: [{ field: 'justification', code: 'not_allowed' }] })
  })

  it('caps the image list', () => {
    const imageRefs = Array.from({ length: 201 }, (_, index) => `image/${index}`)

    expect(
      validateBulkDecisionInput(
        { vulnId: 'CVE-1', imageRefs, status: 'accepted', reason: 'x' },
        NOW,
      ),
    ).toEqual({ ok: false, errors: [{ field: 'imageRefs', code: 'too_many' }] })
  })
})
