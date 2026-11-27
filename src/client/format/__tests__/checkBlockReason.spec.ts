import { describe, expect, it } from 'vitest'

import { MAX_OPEN_CHECKS } from '#core/checkLimits.ts'
import {
  findingCheckReason,
  NOT_PUBLIC_REASON,
  queueRoomReason,
  RESOLVED_REASON,
} from '@/format/checkBlockReason'
import { NO_ACCESS_REASON } from '@/format/accessText'

describe('queueRoomReason', () => {
  it('lets every selection pass that fits into the room left', () => {
    expect(queueRoomReason(0, MAX_OPEN_CHECKS)).toBeNull()
    expect(queueRoomReason(498, 2)).toBeNull()
    expect(queueRoomReason(MAX_OPEN_CHECKS, 0)).toBeNull()
  })

  it('names the open checks and the room left for a selection larger than the room', () => {
    expect(queueRoomReason(498, 3)).toBe(
      'The queue holds at most 500 checks: 498 are open, so at most 2 more fit. Select fewer findings.',
    )
    expect(queueRoomReason(1, 500)).toBe(
      'The queue holds at most 500 checks: 1 is open, so at most 499 more fit. Select fewer findings.',
    )
  })

  it('reports a full queue, also one beyond the cap', () => {
    expect(queueRoomReason(500, 1)).toBe('The queue is full (500 open checks).')
    expect(queueRoomReason(503, 1)).toBe('The queue is full (500 open checks).')
  })
})

describe('findingCheckReason', () => {
  const target = {
    enabled: true,
    workerOnline: true,
    sourceAccess: 'public' as const,
    resolved: false,
    open: null,
  }

  it('names a resolved private finding as resolved, as the server does', () => {
    expect(findingCheckReason({ ...target, resolved: true, sourceAccess: 'private' })).toBe(
      RESOLVED_REASON,
    )
  })

  it('names an open private finding as not public', () => {
    expect(findingCheckReason({ ...target, sourceAccess: 'private' })).toBe(NOT_PUBLIC_REASON)
  })

  it('lets an open public finding pass with the worker online', () => {
    expect(findingCheckReason(target)).toBeNull()
  })
})

describe('findingCheckReason with check access', () => {
  const target = {
    enabled: true,
    workerOnline: true,
    sourceAccess: 'private' as const,
    resolved: false,
    open: null,
  }
  const access = (level: 'public' | 'credential' | 'none') => ({
    imageRef: 'registry.example.com/acme/shop',
    level,
    credentialId: level === 'credential' ? 3 : null,
    credentialLabel: level === 'credential' ? 'Acme registry' : null,
  })

  it('lets a private image pass that a registry credential covers', () => {
    expect(findingCheckReason({ ...target, checkAccess: [access('credential')] })).toBeNull()
  })

  it('names the missing credential instead of public images only', () => {
    expect(findingCheckReason({ ...target, checkAccess: [access('none')] })).toBe(NO_ACCESS_REASON)
    expect(findingCheckReason(target)).toBe(NOT_PUBLIC_REASON)
  })

  it('still names a resolved finding first', () => {
    expect(findingCheckReason({ ...target, resolved: true, checkAccess: [access('none')] })).toBe(
      RESOLVED_REASON,
    )
  })
})
