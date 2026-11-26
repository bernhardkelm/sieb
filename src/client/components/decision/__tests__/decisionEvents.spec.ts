import { describe, expect, it } from 'vitest'

import type { DecisionEvent } from '#core/decisionEvent.ts'
import { describeEvent } from '@/components/decision/decisionEvents'

/**
 * Builds a decision event.
 * @param {DecisionEvent['type']} type - Event type
 * @param {Record<string, unknown>} payload - Payload
 * @returns {DecisionEvent} - Event
 */
const event = (type: DecisionEvent['type'], payload: Record<string, unknown>): DecisionEvent => ({
  id: 1,
  decisionId: 1,
  type,
  actor: 'dev',
  at: '2026-06-01T12:00:00.000Z',
  payload,
})

describe('describeEvent', () => {
  it('names a re-confirm and ignores the cleared re-open timestamp', () => {
    expect(
      describeEvent(
        event('updated', {
          reconfirm: true,
          severityAtDecision: ['Low', 'Critical'],
          reopenedAt: ['2026-05-31T00:00:00.000Z', null],
        }),
      ),
    ).toEqual({ title: 'Re-confirmed', lines: ['Confirmed at severity Critical'] })
    expect(describeEvent(event('updated', { reconfirm: true }))).toEqual({
      title: 'Re-confirmed',
      lines: ['At the current findings'],
    })
  })

  it('lists field changes of a plain edit and never calls it a confirmation', () => {
    expect(describeEvent(event('updated', { reconfirm: false, reason: ['a', 'b'] }))).toEqual({
      title: 'Changed',
      lines: ['Reason: b'],
    })
    expect(describeEvent(event('updated', { reconfirm: false }))).toEqual({
      title: 'Changed',
      lines: ['No field changed'],
    })
  })

  it('names justification changes and the justification of a new decision', () => {
    expect(
      describeEvent(
        event('updated', {
          reconfirm: false,
          status: ['not_affected', 'accepted'],
          justification: ['component_not_present', null],
        }),
      ).lines,
    ).toEqual([
      'Status Not affected → Accepted',
      'Justification Component not present (false positive) → none',
    ])
    expect(
      describeEvent(
        event('created', {
          status: 'not_affected',
          justification: 'inline_mitigations_already_exist',
          reason: 'WAF rule',
          expiresAt: null,
        }),
      ),
    ).toEqual({
      title: 'Decided Not affected',
      lines: ['Justification: Mitigated', 'WAF rule', 'Expires never'],
    })
    expect(
      describeEvent(event('created', { status: 'accepted', reason: 'ok', expiresAt: null })).lines,
    ).toEqual(['ok', 'Expires never'])
  })

  it('explains a re-open from its trigger, also for old events without one', () => {
    expect(
      describeEvent(
        event('reopened', {
          reason: 'severity_rose',
          imageRef: 'index.docker.io/library/redis',
          severity: 'High',
          kev: false,
          baselineSeverity: 'Medium',
          baselineKev: false,
        }),
      ).lines,
    ).toEqual(['Severity rose from Medium to High on redis'])
    expect(describeEvent(event('reopened', { reason: 'kev_listed' })).lines).toEqual([
      'Listed in KEV',
    ])
  })
})
