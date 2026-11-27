import { describe, expect, it } from 'vitest'

import { inboxActionFor } from '@/keyboard/inboxKeymap'
import { hintsForRoute } from '@/keyboard/keyboardHints'
import { ROUTE_NAMES } from '@/router/routeNames'

describe('inboxActionFor', () => {
  it('maps a, d and s to the bulk actions on the page only', () => {
    expect(['a', 'd', 's'].map((key) => inboxActionFor({ key }, 'page'))).toEqual([
      'accept',
      'reject',
      'markSeen',
    ])
    expect(inboxActionFor({ key: 'a' }, 'panel')).toBeNull()
    expect(inboxActionFor({ key: 'd' }, 'overlay')).toBeNull()
  })

  it('lists the selection keys in the Inbox hints as Triage does', () => {
    expect(hintsForRoute(ROUTE_NAMES.INBOX).map((hint) => hint.label)).toEqual([
      'Accept',
      'Reject',
      'Mark as seen',
      'Select',
      'Select range',
      'Select all',
      'Sync',
    ])
  })
})
