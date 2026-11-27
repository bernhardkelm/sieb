import { describe, expect, it } from 'vitest'

import { PROPOSAL_LIMITS, PROPOSAL_VERDICTS, type ProposalVerdict } from '#core/proposal.ts'
import { isUpstreamPendingFix } from '#core/proposalFixUpstream.ts'
import { validateProposalInput } from '#core/proposalValidation.ts'

import { NOW } from './coreBuilders.ts'
import { buildRawProposal } from './proposalBuilders.ts'

const WAITING_FOR = 'k3s release bundling traefik 3.7.17 or later'

const INTERIM = {
  action: 'override the bundled traefik image via HelmChartConfig',
  steps: 'add a HelmChartConfig for traefik with image.tag 3.7.17',
  caveats: 'k3s upgrades may conflict with the override, revert once k3s ships 3.7.17',
}

/**
 * Builds the verdict specific claims a raw proposal needs besides the fix.
 * @param {ProposalVerdict} verdict - Verdict
 * @returns {Record<string, unknown>} - Verdict, justification and missing
 */
const verdictClaims = (verdict: ProposalVerdict): Record<string, unknown> => ({
  verdict,
  justification: verdict === 'not_affected' ? 'vulnerable_code_not_in_execute_path' : null,
  missing: verdict === 'inconclusive' ? ['pull access to the image'] : [],
})

/**
 * Validates a raw proposal and returns its errors as field:code.
 * @param {Record<string, unknown>} overrides - Fields to set
 * @returns {string[]} - Errors, empty when valid
 */
const errorsOf = (overrides: Record<string, unknown>): string[] => {
  const result = validateProposalInput(buildRawProposal(overrides), NOW)

  return result.ok ? [] : result.errors.map(({ field, code }) => `${field}:${code}`)
}

/**
 * Returns the errors the rules of the feature name for one combination, written from the rules
 * rather than the implementation: needs_patch only available, fix_planned must state it,
 * upstream_pending needs waitingFor, waitingFor and interim only with upstream_pending.
 * @param {ProposalVerdict} verdict - Verdict
 * @param {string | undefined} availability - Availability, undefined for absent
 * @param {boolean} waitingFor - Whether waitingFor is given
 * @param {boolean} interim - Whether interim is given
 * @returns {string[]} - Expected errors
 */
const expectedErrors = (
  verdict: ProposalVerdict,
  availability: string | undefined,
  waitingFor: boolean,
  interim: boolean,
): string[] => {
  const patch = verdict === 'needs_patch' || verdict === 'fix_planned'
  const allowed =
    verdict === 'fix_planned' || (verdict === 'needs_patch' && availability !== 'upstream_pending')
  const pending = verdict === 'fix_planned' && availability === 'upstream_pending'
  const errors: string[] = []

  if (availability !== undefined && (!patch || !allowed)) {
    errors.push('fix.availability:not_allowed')
  } else if (availability === undefined && verdict === 'fix_planned') {
    errors.push('fix.availability:required')
  }

  if (waitingFor && !pending) {
    errors.push('fix.waitingFor:not_allowed')
  }

  if (interim && !pending) {
    errors.push('fix.interim:not_allowed')
  }

  if (pending && !waitingFor) {
    errors.push('fix.waitingFor:required')
  }

  return errors
}

const MATRIX = PROPOSAL_VERDICTS.flatMap((verdict) =>
  [undefined, 'available', 'upstream_pending'].flatMap((availability) =>
    [false, true].flatMap((waitingFor) =>
      [false, true].map((interim) => ({ verdict, availability, waitingFor, interim })),
    ),
  ),
)

describe('fix availability', () => {
  it.each(MATRIX)(
    '$verdict with availability $availability, waitingFor $waitingFor, interim $interim',
    ({ verdict, availability, waitingFor, interim }) => {
      const fix = {
        action: 'k3s: wait for a release bundling traefik 3.7.17',
        ...(availability === undefined ? {} : { availability }),
        ...(waitingFor ? { waitingFor: WAITING_FOR } : {}),
        ...(interim ? { interim: INTERIM } : {}),
      }

      expect(errorsOf({ ...verdictClaims(verdict), fix }).sort()).toEqual(
        expectedErrors(verdict, availability, waitingFor, interim).sort(),
      )
    },
  )

  it('stores an upstream_pending fix with what it waits for and the interim workaround', () => {
    const result = validateProposalInput(
      buildRawProposal({
        ...verdictClaims('fix_planned'),
        fix: {
          action: 'k3s: wait for a release bundling traefik 3.7.17',
          availability: 'upstream_pending',
          waitingFor: ` ${WAITING_FOR} `,
          interim: { ...INTERIM, steps: undefined },
        },
      }),
      NOW,
    )

    expect(result).toMatchObject({
      ok: true,
      value: {
        fix: {
          availability: 'upstream_pending',
          waitingFor: WAITING_FOR,
          interim: { action: INTERIM.action, steps: null, caveats: INTERIM.caveats },
        },
      },
    })
    expect(result.ok && isUpstreamPendingFix(result.value)).toBe(true)
  })

  it('needs a review date with upstream_pending', () => {
    const fix = { action: 'k3s: wait', availability: 'upstream_pending', waitingFor: WAITING_FOR }

    expect(errorsOf({ ...verdictClaims('fix_planned'), fix, review: null })).toEqual([
      'review.date:required',
    ])
    expect(
      errorsOf({ ...verdictClaims('fix_planned'), fix, review: { why: 'next release' } }),
    ).toEqual(['review.date:required'])
    expect(
      errorsOf({
        ...verdictClaims('fix_planned'),
        fix: { ...fix, availability: 'available', waitingFor: undefined },
        review: null,
      }),
    ).toEqual([])
  })

  it('reads an absent availability of needs_patch as available', () => {
    const result = validateProposalInput(
      buildRawProposal({ ...verdictClaims('needs_patch'), fix: { action: 'bump xz to 5.6.2' } }),
      NOW,
    )

    expect(result).toMatchObject({ ok: true, value: { fix: { availability: 'available' } } })
    expect(result.ok && isUpstreamPendingFix(result.value)).toBe(false)
  })

  it('checks the values, parts and caps of availability, waitingFor and interim', () => {
    const claims = verdictClaims('fix_planned')
    const fix = { action: 'k3s: wait', availability: 'upstream_pending', waitingFor: WAITING_FOR }

    expect(errorsOf({ ...claims, fix: { ...fix, availability: 'soon' } })).toEqual([
      'fix.availability:invalid',
    ])
    expect(
      errorsOf({
        ...claims,
        fix: { ...fix, waitingFor: 'x'.repeat(PROPOSAL_LIMITS.waitingFor + 1) },
      }),
    ).toEqual(['fix.waitingFor:too_long'])
    expect(errorsOf({ ...claims, fix: { ...fix, interim: 'disable the module' } })).toEqual([
      'fix.interim:invalid',
    ])
    expect(errorsOf({ ...claims, fix: { ...fix, interim: { action: 'x' } } })).toEqual([
      'fix.interim.caveats:required',
    ])
    expect(
      errorsOf({
        ...claims,
        fix: {
          ...fix,
          interim: { ...INTERIM, action: 'x'.repeat(PROPOSAL_LIMITS.interimAction + 1) },
        },
      }),
    ).toEqual(['fix.interim.action:too_long'])
  })
})
