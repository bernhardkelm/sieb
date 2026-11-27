import { describe, expect, it } from 'vitest'

import { PROPOSAL_CLIENT_KINDS } from '#core/proposalClient.ts'
import { proposalClientLabel } from '@/format/proposalClientLabel'

describe('proposalClientLabel', () => {
  it('labels every client kind without echoing the agent', () => {
    const labels = PROPOSAL_CLIENT_KINDS.map((clientKind) =>
      proposalClientLabel({ clientKind, clientLabel: 'Auto-check #2', agent: '<b>forged</b>' }),
    )

    expect(labels).toEqual([
      'Claude app',
      'Claude Code',
      'Claude Code (CLI)',
      'Claude Code (headless)',
      'Claude Code (VS Code)',
      'Claude Code (app)',
      'Auto-check #2',
    ])
  })

  it('falls back to the agent and the client label without a kind', () => {
    expect(proposalClientLabel({ clientKind: null, clientLabel: 'laptop', agent: 'Cursor' })).toBe(
      'Cursor (laptop)',
    )
    expect(proposalClientLabel({ clientKind: null, clientLabel: 'laptop', agent: 'laptop' })).toBe(
      'laptop',
    )
    expect(proposalClientLabel({ clientKind: null, clientLabel: 'claude.ai', agent: '' })).toBe(
      'claude.ai',
    )
  })
})
