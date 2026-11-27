import { describe, expect, it } from 'vitest'

import { NOW } from '#core/__tests__/coreBuilders.ts'
import { buildRawProposal } from '#core/__tests__/proposalBuilders.ts'
import { validateProposalInput } from '#core/proposalValidation.ts'

/**
 * Returns the validation errors of a raw proposal with the given related fields.
 * @param {Record<string, unknown>} overrides - Fields to set
 * @returns {unknown[]} - Errors, empty when valid
 */
const errorsOf = (overrides: Record<string, unknown>): unknown[] => {
  const result = validateProposalInput(buildRawProposal(overrides), NOW)

  return result.ok ? [] : result.errors
}

describe('validateProposalInput with related findings', () => {
  it('reads related findings with cleaned notes and the shared reason', () => {
    const result = validateProposalInput(
      buildRawProposal({
        relatedFindings: [{ findingId: 4, note: ' same​ pseudo-version ' }, { findingId: 9 }],
        relatedReason: 'The coredns module is a pseudo-version.\n',
      }),
      NOW,
    )

    expect(result.ok && result.value).toMatchObject({
      relatedFindings: [
        { findingId: 4, note: 'same pseudo-version' },
        { findingId: 9, note: null },
      ],
      relatedReason: 'The coredns module is a pseudo-version.',
    })
  })

  it('defaults to no related findings and no reason', () => {
    const result = validateProposalInput(buildRawProposal(), NOW)

    expect(result.ok && result.value).toMatchObject({ relatedFindings: [], relatedReason: null })
  })

  it('refuses more than 50 entries, duplicates and invalid ids', () => {
    const many = Array.from({ length: 51 }, (_, index) => ({ findingId: index + 1 }))

    expect(errorsOf({ relatedFindings: many })).toEqual([
      { field: 'relatedFindings', code: 'too_many' },
    ])
    expect(errorsOf({ relatedFindings: many.slice(0, 50) })).toEqual([])
    expect(
      errorsOf({
        relatedFindings: [
          { findingId: 3 },
          { findingId: 3 },
          { findingId: 0 },
          { findingId: 1.5 },
          { note: 'x' },
          'CVE-1',
        ],
      }),
    ).toEqual([
      { field: 'relatedFindings.1.findingId', code: 'duplicate' },
      { field: 'relatedFindings.2.findingId', code: 'invalid' },
      { field: 'relatedFindings.3.findingId', code: 'invalid' },
      { field: 'relatedFindings.4.findingId', code: 'required' },
      { field: 'relatedFindings.5', code: 'invalid' },
    ])
    expect(errorsOf({ relatedFindings: { findingId: 3 } })).toEqual([
      { field: 'relatedFindings', code: 'invalid' },
    ])
  })

  it('caps the note like an unknown and the reason like the summary', () => {
    expect(errorsOf({ relatedFindings: [{ findingId: 3, note: 'x'.repeat(1001) }] })).toEqual([
      { field: 'relatedFindings.0.note', code: 'too_long' },
    ])
    expect(
      errorsOf({ relatedFindings: [{ findingId: 3 }], relatedReason: 'x'.repeat(1001) }),
    ).toEqual([{ field: 'relatedReason', code: 'too_long' }])
  })

  it('allows the reason only together with related findings', () => {
    expect(errorsOf({ relatedReason: 'Same cause.' })).toEqual([
      { field: 'relatedReason', code: 'not_allowed' },
    ])
    expect(errorsOf({ relatedFindings: [], relatedReason: 'Same cause.' })).toEqual([
      { field: 'relatedReason', code: 'not_allowed' },
    ])
  })
})
