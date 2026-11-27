import { describe, expect, it } from 'vitest'

import { isDecidableVerdict, PROPOSAL_LIMITS } from '#core/proposal.ts'
import { lacksReviewerStatus, proposalDecisionValues } from '#core/proposalAccept.ts'
import { validateProposalInput } from '#core/proposalValidation.ts'

import { NOW } from './coreBuilders.ts'
import { buildProposalInput, buildRawProposal } from './proposalBuilders.ts'

const INCONCLUSIVE = {
  verdict: 'inconclusive',
  justification: undefined,
  confidence: 'low',
  fix: undefined,
  missing: ['pull access to registry.example.com/app', ' advisory text not reachable '],
}

/**
 * Validates a raw proposal and returns its errors.
 * @param {Record<string, unknown>} overrides - Fields to set
 * @returns {unknown} - Errors, empty when valid
 */
const errorsOf = (overrides: Record<string, unknown>): unknown => {
  const result = validateProposalInput(buildRawProposal(overrides), NOW)

  return result.ok ? [] : result.errors
}

describe('verdict inconclusive', () => {
  it('validates with what is missing, without a patch action or justification', () => {
    const result = validateProposalInput(buildRawProposal(INCONCLUSIVE), NOW)

    expect(result).toMatchObject({
      ok: true,
      value: {
        verdict: 'inconclusive',
        justification: null,
        confidence: 'low',
        fix: null,
        missing: ['pull access to registry.example.com/app', 'advisory text not reachable'],
      },
    })
  })

  it('requires missing and keeps confidence required', () => {
    expect(errorsOf({ ...INCONCLUSIVE, missing: undefined })).toEqual([
      { field: 'missing', code: 'required' },
    ])
    expect(errorsOf({ ...INCONCLUSIVE, missing: [' '] })).toEqual([
      { field: 'missing', code: 'required' },
    ])
    expect(errorsOf({ ...INCONCLUSIVE, confidence: undefined })).toEqual([
      { field: 'confidence', code: 'required' },
    ])
  })

  it('caps the missing list and its entries', () => {
    expect(
      errorsOf({ ...INCONCLUSIVE, missing: Array(PROPOSAL_LIMITS.missingItems + 1).fill('x') }),
    ).toEqual([{ field: 'missing', code: 'too_many' }])
    expect(
      errorsOf({ ...INCONCLUSIVE, missing: ['x'.repeat(PROPOSAL_LIMITS.missing + 1)] }),
    ).toEqual([{ field: 'missing.0', code: 'too_long' }])
    expect(errorsOf({ ...INCONCLUSIVE, missing: 'registry access' })).toEqual([
      { field: 'missing', code: 'invalid' },
    ])
  })

  it('refuses a justification and refuses missing on every other verdict', () => {
    expect(
      errorsOf({ ...INCONCLUSIVE, justification: 'vulnerable_code_not_in_execute_path' }),
    ).toEqual([{ field: 'justification', code: 'not_allowed' }])
    expect(errorsOf({ missing: ['registry access'] })).toEqual([
      { field: 'missing', code: 'not_allowed' },
    ])
    expect(errorsOf({ missing: [] })).toEqual([])
    expect(validateProposalInput(buildRawProposal(), NOW)).toMatchObject({
      ok: true,
      value: { missing: [] },
    })
  })

  it('never yields decision values and needs the reviewer status to accept', () => {
    const claims = buildProposalInput({
      verdict: 'inconclusive',
      justification: null,
      missing: ['registry access'],
    })

    expect(isDecidableVerdict('inconclusive')).toBe(false)
    expect(isDecidableVerdict('needs_patch')).toBe(true)
    expect(proposalDecisionValues(claims, NOW)).toBeNull()
    expect(lacksReviewerStatus(claims, undefined)).toBe(true)
    expect(lacksReviewerStatus(claims, { reason: 'x' })).toBe(true)
    expect(lacksReviewerStatus(claims, { status: 'accepted' })).toBe(false)
    expect(lacksReviewerStatus(buildProposalInput(), undefined)).toBe(false)
  })
})
