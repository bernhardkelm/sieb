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
        fix: {
          action: 'upgrade openssl to 3.0.2',
          fixedVersion: '3.0.2',
          change: 'bump the base image',
          effort: 'small',
        },
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

  it.each(['needs_patch', 'fix_planned'])('needs a patch action for %s', (verdict) => {
    const changeOnly = { fixedVersion: '3.0.2', change: 'bump the base image' }

    expect(errorsOf({ verdict, justification: null, fix: null })).toEqual([
      { field: 'fix.action', code: 'required' },
    ])
    expect(errorsOf({ verdict, justification: null, fix: changeOnly })).toEqual([
      { field: 'fix.action', code: 'required' },
    ])
    expect(errorsOf({ verdict, justification: null, fix: { action: ' ' } })).toEqual([
      { field: 'fix.action', code: 'required' },
    ])
    expect(errorsOf({ verdict, justification: null })).toEqual([])
    expect(
      errorsOf({ verdict, justification: null, fix: { action: 'no fixed version yet' } }),
    ).toEqual([])
  })

  it('takes an optional patch layer from the known ones', () => {
    const fix = { action: 'base image: rebuild on alpine:3.24.4 (libxslt 1.1.43-r4)' }

    expect(
      validateProposalInput(buildRawProposal({ fix: { ...fix, layer: 'base_image' } }), NOW),
    ).toMatchObject({ ok: true, value: { fix: { layer: 'base_image' } } })
    expect(validateProposalInput(buildRawProposal({ fix }), NOW)).toMatchObject({
      ok: true,
      value: { fix: { layer: null } },
    })
    expect(errorsOf({ fix: { ...fix, layer: 'kernel' } })).toEqual([
      { field: 'fix.layer', code: 'invalid' },
    ])
  })

  it('does not need a patch action for not_affected and accepted', () => {
    expect(errorsOf({ fix: null })).toEqual([])
    expect(errorsOf({ verdict: 'accepted', justification: null, fix: null })).toEqual([])
  })

  it('keeps the patch action on one line within its cap', () => {
    const result = validateProposalInput(
      buildRawProposal({ fix: { action: 'upgrade libxslt\nto 1.1.43-r4' } }),
      NOW,
    )

    expect(result).toMatchObject({
      ok: true,
      value: { fix: { action: 'upgrade libxslt to 1.1.43-r4', fixedVersion: null } },
    })
    expect(errorsOf({ fix: { action: 'x'.repeat(PROPOSAL_LIMITS.fixAction + 1) } })).toEqual([
      { field: 'fix.action', code: 'too_long' },
    ])
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
