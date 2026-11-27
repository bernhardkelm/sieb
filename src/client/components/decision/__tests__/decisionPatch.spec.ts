import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildDecision, NOW } from '#core/__tests__/coreBuilders.ts'
import {
  fromDateInput,
  initialFromDecision,
  toDateInput,
  type DecisionFormValue,
} from '@/components/decision/decisionFormModel'
import { decisionPatch } from '@/components/decision/decisionPatch'

const STORED_EXPIRY = '2026-09-01T00:00:00.000Z'

const decision = buildDecision({
  status: 'accepted',
  reason: 'internal only',
  expiresAt: STORED_EXPIRY,
})

/**
 * Builds the values the form submits for the stored decision, untouched.
 * @param {Partial<DecisionFormValue>} overrides - Fields to set
 * @returns {DecisionFormValue} - Form values
 */
const value = (overrides: Partial<DecisionFormValue> = {}): DecisionFormValue => ({
  status: 'accepted',
  justification: null,
  reason: 'internal only',
  scope: 'image',
  expiresAt: fromDateInput(toDateInput(STORED_EXPIRY)),
  expiryTouched: false,
  reconfirm: false,
  upstreamPending: false,
  waitingFor: null,
  ...overrides,
})

let timeZone: string | undefined

beforeEach(() => {
  timeZone = process.env.TZ
  process.env.TZ = 'America/Los_Angeles'
})

afterEach(() => {
  process.env.TZ = timeZone
})

describe('decisionPatch', () => {
  it('round trips the stored expiry through the date input to another instant', () => {
    expect(toDateInput(STORED_EXPIRY)).toBe('2026-08-31')
    expect(fromDateInput('2026-08-31')).toBe('2026-09-01T06:59:59.000Z')
  })

  it('sends a changed justification only while the status is not affected', () => {
    const justified = buildDecision({ justification: 'component_not_present' })
    const untouched = initialFromDecision(justified, NOW)
    const same = value({ ...untouched, expiresAt: null, status: 'not_affected' })

    expect(untouched.justification).toBe('component_not_present')
    expect(decisionPatch(justified, same, NOW)).toEqual({})
    expect(decisionPatch(justified, { ...same, justification: null }, NOW)).toEqual({
      justification: null,
    })
    expect(
      decisionPatch(justified, { ...same, justification: 'inline_mitigations_already_exist' }, NOW),
    ).toEqual({ justification: 'inline_mitigations_already_exist' })
    expect(
      decisionPatch(justified, { ...same, status: 'accepted', justification: null }, NOW),
    ).toEqual({ status: 'accepted' })
    expect(
      decisionPatch(
        decision,
        value({ status: 'not_affected', justification: 'component_not_present' }),
        NOW,
      ),
    ).toMatchObject({ status: 'not_affected', justification: 'component_not_present' })
  })

  it('sends only the reason when only the reason changed', () => {
    expect(decisionPatch(decision, value({ reason: 'behind VPN' }), NOW)).toEqual({
      reason: 'behind VPN',
    })
  })

  it('leaves out an untouched expiry on a status change, so the server applies its default', () => {
    expect(
      decisionPatch(decision, value({ status: 'not_affected', expiresAt: null }), NOW),
    ).toEqual({ status: 'not_affected' })
  })

  it('keeps the stored instant when the date is picked back to the stored day', () => {
    const touched = value({ expiryTouched: true })

    expect(decisionPatch(decision, touched, NOW)).toEqual({})
    expect(decisionPatch(decision, { ...touched, status: 'not_affected' }, NOW)).toEqual({
      status: 'not_affected',
      expiresAt: STORED_EXPIRY,
    })
  })

  it('sends a newly picked date or never', () => {
    const picked = fromDateInput('2026-07-15')

    expect(decisionPatch(decision, value({ expiryTouched: true, expiresAt: picked }), NOW)).toEqual(
      { expiresAt: picked },
    )
    expect(decisionPatch(decision, value({ expiryTouched: true, expiresAt: null }), NOW)).toEqual({
      expiresAt: null,
    })
  })

  it('revives a lapsed decision with the date the form shows', () => {
    const lapsed = buildDecision({ status: 'accepted', expiresAt: '2026-05-01T00:00:00.000Z' })
    const shown = initialFromDecision(lapsed, NOW).expiresAt ?? null

    expect(shown).not.toBeNull()
    expect(decisionPatch(lapsed, value({ reason: lapsed.reason, expiresAt: shown }), NOW)).toEqual({
      expiresAt: shown,
    })
  })

  it('adds reconfirm to the changed fields', () => {
    expect(decisionPatch(decision, value({ reconfirm: true }), NOW)).toEqual({ reconfirm: true })
    expect(decisionPatch(decision, value({ reconfirm: true, reason: 'still fine' }), NOW)).toEqual({
      reason: 'still fine',
      reconfirm: true,
    })
  })
})
