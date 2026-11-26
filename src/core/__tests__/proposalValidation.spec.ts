import { describe, expect, it } from 'vitest'

import { PROPOSAL_LIMITS } from '#core/proposal.ts'
import { cleanText } from '#core/proposalTextReaders.ts'
import { validateProposalInput } from '#core/proposalValidation.ts'

import { NOW } from './coreBuilders.ts'
import { buildRawProposal } from './proposalBuilders.ts'

/**
 * Validates a raw proposal and returns its errors.
 * @param {Record<string, unknown>} overrides - Fields to set
 * @returns {unknown} - Errors, empty when valid
 */
const errorsOf = (overrides: Record<string, unknown>): unknown => {
  const result = validateProposalInput(buildRawProposal(overrides), NOW)

  return result.ok ? [] : result.errors
}

describe('validateProposalInput', () => {
  it('accepts a complete proposal and normalises lists and dates', () => {
    const result = validateProposalInput(
      buildRawProposal({
        imageRefs: ['img/b', 'img/a', 'img/b'],
        evidenceBasis: ['image', 'image', 'advisory'],
        references: ['https://example.org/a', 'https://example.org/a'],
      }),
      NOW,
    )

    expect(result).toMatchObject({
      ok: true,
      value: {
        imageRefs: ['img/a', 'img/b'],
        evidenceBasis: ['image', 'advisory'],
        references: ['https://example.org/a'],
        review: { date: '2026-09-01T23:59:59.999Z', why: 'next base image release' },
        fix: { fixedVersion: '3.0.2', change: 'bump the base image', effort: 'small' },
        agent: 'Claude Code',
      },
    })
  })

  it('requires the target, verdict, summary, confidence and evidence basis', () => {
    expect(
      errorsOf({
        vulnId: ' ',
        scope: undefined,
        verdict: undefined,
        justification: undefined,
        summary: undefined,
        confidence: undefined,
        evidenceBasis: [],
      }),
    ).toEqual([
      { field: 'vulnId', code: 'required' },
      { field: 'scope', code: 'required' },
      { field: 'verdict', code: 'required' },
      { field: 'summary', code: 'required' },
      { field: 'confidence', code: 'required' },
      { field: 'evidenceBasis', code: 'required' },
    ])
    expect(errorsOf({ evidenceBasis: undefined })).toEqual([
      { field: 'evidenceBasis', code: 'required' },
    ])
    expect(errorsOf({ evidenceBasis: ['guess'] })).toEqual([
      { field: 'evidenceBasis.0', code: 'invalid' },
    ])
  })

  it('checks the images against the scope', () => {
    expect(errorsOf({ imageRefs: [] })).toEqual([{ field: 'imageRefs', code: 'required' }])
    expect(errorsOf({ scope: 'all' })).toEqual([{ field: 'imageRefs', code: 'not_allowed' }])
    expect(errorsOf({ scope: 'all', imageRefs: null })).toEqual([])
    expect(errorsOf({ imageRefs: Array.from({ length: 201 }, (_, i) => `img/${i}`) })).toEqual([
      { field: 'imageRefs', code: 'too_many' },
    ])
  })

  it('allows a justification only with not_affected and requires it there', () => {
    expect(errorsOf({ justification: undefined })).toEqual([
      { field: 'justification', code: 'required' },
    ])
    expect(errorsOf({ verdict: 'accepted' })).toEqual([
      { field: 'justification', code: 'not_allowed' },
    ])
    expect(errorsOf({ verdict: 'needs_patch' })).toEqual([
      { field: 'justification', code: 'not_allowed' },
    ])
    expect(errorsOf({ justification: 'because' })).toEqual([
      { field: 'justification', code: 'invalid' },
    ])
    expect(errorsOf({ verdict: 'accepted', justification: null })).toEqual([])
  })

  it('needs a fix change for needs_patch', () => {
    expect(errorsOf({ verdict: 'needs_patch', justification: null, fix: null })).toEqual([
      { field: 'fix.change', code: 'required' },
    ])
    expect(errorsOf({ verdict: 'needs_patch', justification: null })).toEqual([])
  })

  it('enforces the caps of text and lists', () => {
    expect(errorsOf({ summary: 'x'.repeat(PROPOSAL_LIMITS.summary + 1) })).toEqual([
      { field: 'summary', code: 'too_long' },
    ])
    expect(errorsOf({ presence: 'x'.repeat(PROPOSAL_LIMITS.narrative + 1) })).toEqual([
      { field: 'presence', code: 'too_long' },
    ])
    expect(
      errorsOf({
        evidence: [{ check: 'c', method: 'm', result: 'r'.repeat(2001) }, { check: 'c' }],
      }),
    ).toEqual([
      { field: 'evidence.0.result', code: 'too_long' },
      { field: 'evidence.1.method', code: 'required' },
      { field: 'evidence.1.result', code: 'required' },
    ])
    expect(errorsOf({ unknowns: Array.from({ length: 21 }, () => 'u') })).toEqual([
      { field: 'unknowns', code: 'too_many' },
    ])
    expect(errorsOf({ agent: 'a'.repeat(101), fix: 'soon' })).toEqual([
      { field: 'fix', code: 'invalid' },
      { field: 'agent', code: 'too_long' },
    ])
  })

  it('accepts only http(s) references and future review dates', () => {
    expect(
      errorsOf({
        references: ['javascript:alert(1)', 'https://user:pw@example.org', 'ftp://x', 'http://ok'],
      }),
    ).toEqual([
      { field: 'references.0', code: 'invalid' },
      { field: 'references.1', code: 'invalid' },
      { field: 'references.2', code: 'invalid' },
    ])
    expect(errorsOf({ review: { date: '2020-01-01' } })).toEqual([
      { field: 'review.date', code: 'in_past' },
    ])
  })

  it('strips control and bidirectional characters', () => {
    const result = validateProposalInput(
      buildRawProposal({ summary: 'line one\r\nline\u0007 two‮', agent: 'Claude\nCode' }),
      NOW,
    )

    expect(result).toMatchObject({
      ok: true,
      value: { summary: 'line one\nline two', agent: 'Claude Code' },
    })
    expect(cleanText('\u0000\t a\tb ', true)).toBe('a b')
  })

  it('strips the Arabic letter mark, zero-width characters and soft hyphens', () => {
    const hidden = ['\u061C', '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF', '\u00AD']

    for (const char of hidden) {
      expect(cleanText(`not${char} affected`, false)).toBe('not affected')
      expect(cleanText(`${char}line one\nline${char} two`, true)).toBe('line one\nline two')
    }

    expect(
      validateProposalInput(buildRawProposal({ summary: 'Safe\u200B\u061C\uFEFF here' }), NOW),
    ).toMatchObject({ ok: true, value: { summary: 'Safe here' } })
  })
})
