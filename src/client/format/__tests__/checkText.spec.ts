import { describe, expect, it } from 'vitest'

import { buildCheck } from '@/__tests__/checkBuilders'
import {
  findingCheckReason,
  NOT_PUBLIC_REASON,
  selectionCheckReason,
  WORKER_OFFLINE_REASON,
  CHECKS_OFF_REASON,
  ALL_OPEN_REASON,
  RESOLVED_REASON,
} from '@/format/checkBlockReason'
import { checkCreateNotice, costText, skippedSummary, usageText } from '@/format/checkResultText'
import { checkChipHint, checkChipLabel, formatElapsed } from '@/format/checkText'
import { docsLinkOf } from '@/format/docsLink'

const NOW = new Date('2026-06-01T12:00:00.000Z')

describe('checkChipLabel', () => {
  it.each([
    [buildCheck({ position: 3 }), 'Queued · #3'],
    [
      buildCheck({
        state: 'running',
        phase: 'investigating',
        startedAt: '2026-06-01T11:58:55.000Z',
      }),
      'Checking · investigating · 1m 05s',
    ],
    [buildCheck({ state: 'running', phase: null, startedAt: null }), 'Checking · preparing · 0s'],
    [buildCheck({ state: 'failed', error: 'Timed out' }), 'Check failed'],
    [buildCheck({ state: 'done', proposalId: 12 }), 'Checked · proposal #12'],
    [buildCheck({ state: 'done', proposalId: null }), 'Checked, no proposal'],
    [buildCheck({ state: 'cancelled' }), 'Check cancelled'],
  ])('labels %#', (check, label) => {
    expect(checkChipLabel(check, NOW)).toBe(label)
  })

  it('puts the failure reason in the tooltip', () => {
    expect(checkChipHint(buildCheck({ state: 'failed', error: 'Timed out' }))).toBe(
      'Check failed: Timed out',
    )
  })
})

describe('formatElapsed', () => {
  it.each([
    [-5, '0s'],
    [42_000, '42s'],
    [187_000, '3m 07s'],
    [3_720_000, '1h 02m'],
  ])('formats %d ms as %s', (ms, text) => {
    expect(formatElapsed(ms)).toBe(text)
  })
})

describe('check create notice', () => {
  it('names the queue position of a single check and the skipped reasons', () => {
    const notice = checkCreateNotice({
      queued: [buildCheck({ position: 4 })],
      skipped: [
        { findingId: 2, reason: 'not_public' },
        { findingId: 3, reason: 'not_public' },
        { findingId: 4, reason: 'already_open' },
      ],
    })

    expect(notice).toEqual({
      title: 'Auto-check queued at #4',
      description: 'Skipped 3: 2 without access to the image, 1 already queued or running.',
      none: false,
    })
  })

  it('counts several queued checks and flags an answer that queued nothing', () => {
    expect(
      checkCreateNotice({ queued: [buildCheck({ id: 1 }), buildCheck({ id: 2 })], skipped: [] }),
    ).toEqual({ title: '2 Auto-checks queued', description: undefined, none: false })
    expect(
      checkCreateNotice({ queued: [], skipped: [{ findingId: 1, reason: 'resolved' }] }),
    ).toEqual({ title: 'No check queued', description: 'Skipped 1: 1 resolved.', none: true })
    expect(skippedSummary([])).toBe('')
  })
})

describe('usage texts', () => {
  it('describes tokens, turns and the cost estimate', () => {
    expect(
      usageText({
        inputTokens: 12_345,
        outputTokens: 1_104,
        cacheReadTokens: 30_000,
        cacheCreationTokens: 10_000,
        costUsd: 0.4212,
        turns: 8,
      }),
    ).toBe('12.3K in · 1,104 out · 40K cache')
    expect(costText(0.4212)).toBe('$0.42')
    expect(costText(0.0021)).toBe('$0.0021')
    expect(costText(null)).toBeNull()
  })
})

describe('check block reasons', () => {
  const ready = { enabled: true, workerOnline: true, resolved: false, open: null }

  it('blocks on the feature, the worker, an open check, a resolved finding and the source access', () => {
    expect(findingCheckReason({ ...ready, sourceAccess: 'public' })).toBeNull()
    expect(findingCheckReason({ ...ready, enabled: false, sourceAccess: 'public' })).toBe(
      CHECKS_OFF_REASON,
    )
    expect(findingCheckReason({ ...ready, workerOnline: false, sourceAccess: 'public' })).toBe(
      WORKER_OFFLINE_REASON,
    )
    expect(
      findingCheckReason({ ...ready, sourceAccess: 'public', open: buildCheck({ position: 2 }) }),
    ).toBe('A check of this finding is already queued at #2.')
    expect(findingCheckReason({ ...ready, resolved: true, sourceAccess: 'public' })).toBe(
      RESOLVED_REASON,
    )
    expect(findingCheckReason({ ...ready, sourceAccess: 'private' })).toBe(NOT_PUBLIC_REASON)
    expect(findingCheckReason({ ...ready, sourceAccess: 'unknown' })).toBe(NOT_PUBLIC_REASON)
  })

  it('blocks a selection only when nothing is left to queue', () => {
    expect(selectionCheckReason({ enabled: true, workerOnline: true }, 2)).toBeNull()
    expect(selectionCheckReason({ enabled: true, workerOnline: true }, 0)).toBe(ALL_OPEN_REASON)
    expect(selectionCheckReason({ enabled: true, workerOnline: false }, 2)).toBe(
      WORKER_OFFLINE_REASON,
    )
  })
})

describe('docsLinkOf', () => {
  it('derives the docs file from a GitHub tree link and gives up on other links', () => {
    expect(
      docsLinkOf('https://github.com/bernhardkelm/sieb/tree/0.4.0', 'docs/auto-check.md'),
    ).toBe('https://github.com/bernhardkelm/sieb/blob/0.4.0/docs/auto-check.md')
    expect(docsLinkOf('https://git.example.com/fork', 'docs/auto-check.md')).toBeNull()
    expect(docsLinkOf(null, 'docs/auto-check.md')).toBeNull()
  })
})
