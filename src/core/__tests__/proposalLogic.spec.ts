import { describe, expect, it } from 'vitest'

import { MAX_REASON_LENGTH } from '#core/decisionFieldReaders.ts'
import { validateAcceptEdits } from '#core/proposalAccept.ts'
import {
  currentDecisionRefs,
  isProposalOutdated,
  matchesExpectedDecisions,
  sameExpectedDecisionIds,
} from '#core/proposalFreshness.ts'
import { generateProposalReason } from '#core/proposalReason.ts'

import { buildDecision, NOW } from './coreBuilders.ts'
import { buildProposalInput } from './proposalBuilders.ts'

const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'

describe('proposal freshness', () => {
  const target = buildProposalInput({ imageRefs: [REDIS, NGINX] })
  const all = buildDecision({ id: 2, scope: 'all', imageRef: null })
  const own = buildDecision({ id: 3, imageRef: REDIS })

  it('lists the governing decision per target image, an all-scope one included', () => {
    expect(currentDecisionRefs(target, [all, own])).toEqual([
      { imageRef: NGINX, decisionId: 2, updatedAt: all.updatedAt },
      { imageRef: REDIS, decisionId: 3, updatedAt: own.updatedAt },
    ])
    expect(currentDecisionRefs({ ...target, scope: 'all', imageRefs: null }, [own])).toEqual([
      { imageRef: null, decisionId: null, updatedAt: null },
    ])
  })

  it('is outdated when a governing decision was added, changed or revoked', () => {
    const basis = currentDecisionRefs(target, [own])

    expect(isProposalOutdated(basis, currentDecisionRefs(target, [own]))).toBe(false)
    expect(isProposalOutdated(basis, currentDecisionRefs(target, [all, own]))).toBe(true)
    expect(
      isProposalOutdated(basis, currentDecisionRefs(target, [{ ...own, updatedAt: 'later' }])),
    ).toBe(true)
    expect(
      isProposalOutdated(basis, currentDecisionRefs(target, [{ ...own, revokedAt: 'later' }])),
    ).toBe(true)
  })

  it('matches expected decisions exactly, one per target and in the version seen', () => {
    const current = currentDecisionRefs(target, [own])
    const seen = { imageRef: REDIS, decisionId: 3, updatedAt: own.updatedAt }
    const none = { imageRef: NGINX, decisionId: null, updatedAt: null }

    expect(matchesExpectedDecisions([seen, none], current)).toBe(true)
    expect(matchesExpectedDecisions([seen], current)).toBe(false)
    expect(matchesExpectedDecisions([{ ...seen, decisionId: 4 }, none], current)).toBe(false)
    expect(matchesExpectedDecisions([{ ...seen, updatedAt: 'earlier' }, none], current)).toBe(false)
    expect(sameExpectedDecisionIds([none, seen], [seen, none])).toBe(true)
    expect(sameExpectedDecisionIds([seen, none], [{ ...seen, updatedAt: 'later' }, none])).toBe(
      false,
    )
  })
})

describe('generateProposalReason', () => {
  it('combines verdict, summary, key evidence, fix and confidence', () => {
    expect(
      generateProposalReason(
        buildProposalInput({
          evidence: [
            { check: 'callers', method: 'grep', result: 'none\nfound' },
            { check: 'flags', method: 'ps', result: 'off' },
          ],
          fix: {
            action: null,
            layer: null,
            fixedVersion: null,
            change: 'bump base image',
            effort: null,
          },
        }),
      ),
    ).toBe(
      'Not affected (vulnerable_code_not_in_execute_path): The vulnerable parser is never called.\n' +
        'Evidence: callers: none found; flags: off\n' +
        'Fix: bump base image\n' +
        'Confidence medium, evidence basis image.',
    )
  })

  it('starts with the patch action for a patch verdict, the summary below', () => {
    const fix = {
      action: 'upgrade libxslt to 1.1.43-r4 (rebuild on the current base)',
      layer: null,
      fixedVersion: '1.1.43-r4',
      change: 'rebuild the image',
      effort: null,
    }

    for (const verdict of ['needs_patch', 'fix_planned'] as const) {
      const reason = generateProposalReason(
        buildProposalInput({ verdict, justification: null, evidence: [], fix }),
      )

      expect(reason.split('\n').slice(0, 2)).toEqual([
        `${verdict === 'needs_patch' ? 'Needs patch' : 'Fix planned'}: upgrade libxslt to 1.1.43-r4 (rebuild on the current base)`,
        'The vulnerable parser is never called.',
      ])
      expect(reason).toContain('Fix: rebuild the image')
    }

    expect(
      generateProposalReason(
        buildProposalInput({ verdict: 'accepted', justification: null, evidence: [], fix }),
      ).startsWith('Accepted: The vulnerable parser is never called.\n'),
    ).toBe(true)
    expect(
      generateProposalReason(
        buildProposalInput({ verdict: 'needs_patch', justification: null, evidence: [] }),
      ).startsWith('Needs patch: The vulnerable parser is never called.\n'),
    ).toBe(true)
  })

  it('stays within the reason limit and keeps the confidence line', () => {
    const reason = generateProposalReason(
      buildProposalInput({
        summary: 's'.repeat(1000),
        evidence: Array.from({ length: 30 }, () => ({
          check: 'c'.repeat(500),
          method: 'm',
          result: 'r'.repeat(2000),
        })),
        fix: {
          action: null,
          layer: null,
          fixedVersion: null,
          change: 'f'.repeat(2000),
          effort: null,
        },
      }),
    )

    expect(reason.length).toBeLessThanOrEqual(MAX_REASON_LENGTH)
    expect(reason.endsWith('Confidence medium, evidence basis image.')).toBe(true)
  })
})

describe('validateAcceptEdits', () => {
  const later = new Date('2026-07-01T00:00:00.000Z')

  it('takes the proposal values without edits, needs_patch as fix_planned', () => {
    const plan = validateAcceptEdits(
      buildProposalInput({
        verdict: 'needs_patch',
        justification: null,
        review: { date: '2026-09-01T23:59:59.999Z', why: null },
      }),
      undefined,
      later,
    )

    expect(plan).toMatchObject({
      ok: true,
      value: {
        values: {
          status: 'fix_planned',
          justification: null,
          expiresAt: '2026-09-01T23:59:59.999Z',
        },
        editedFields: [],
      },
    })
  })

  it('merges edits and names the fields that differ', () => {
    expect(
      validateAcceptEdits(
        buildProposalInput(),
        { status: 'accepted', reason: 'Risk accepted', expiresAt: null },
        later,
      ),
    ).toEqual({
      ok: true,
      value: {
        values: {
          status: 'accepted',
          justification: null,
          reason: 'Risk accepted',
          expiresAt: null,
        },
        editedFields: ['status', 'reason'],
      },
    })
  })

  it('refuses scope and image edits and invalid values', () => {
    expect(
      validateAcceptEdits(
        buildProposalInput({ verdict: 'accepted', justification: null }),
        {
          scope: 'all',
          imageRefs: [],
          justification: 'component_not_present',
          expiresAt: '2020-01-01',
        },
        NOW,
      ),
    ).toEqual({
      ok: false,
      errors: [
        { field: 'edits.scope', code: 'not_allowed' },
        { field: 'edits.imageRefs', code: 'not_allowed' },
        { field: 'edits.justification', code: 'not_allowed' },
        { field: 'edits.expiresAt', code: 'in_past' },
      ],
    })
    expect(validateAcceptEdits(buildProposalInput(), [], NOW)).toEqual({
      ok: false,
      errors: [{ field: 'edits', code: 'invalid' }],
    })
  })
})
