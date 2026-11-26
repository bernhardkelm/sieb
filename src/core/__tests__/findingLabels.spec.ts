import { describe, expect, it } from 'vitest'

import { summarizeFindingLabels } from '#core/findingLabels.ts'

import { buildFinding, NOW } from './coreBuilders.ts'

describe('summarizeFindingLabels', () => {
  it('reports no labels when no open finding has one', () => {
    expect(
      summarizeFindingLabels([
        buildFinding({ exposure: null, owner: null }),
        buildFinding({ id: 2, exposure: 'public', owner: 'self', resolvedAt: NOW.toISOString() }),
      ]),
    ).toEqual({ exposure: false, owners: [] })
  })

  it('reports exposure without owners and owners without exposure', () => {
    expect(summarizeFindingLabels([buildFinding({ exposure: 'internal', owner: null })])).toEqual({
      exposure: true,
      owners: [],
    })
    expect(summarizeFindingLabels([buildFinding({ exposure: null, owner: 'ops' })])).toEqual({
      exposure: false,
      owners: ['ops'],
    })
  })

  it('lists distinct owners self first when only some findings carry labels', () => {
    expect(
      summarizeFindingLabels([
        buildFinding({ exposure: null, owner: 'third-party' }),
        buildFinding({ id: 2, exposure: 'gated', owner: null }),
        buildFinding({ id: 3, exposure: null, owner: 'self' }),
        buildFinding({ id: 4, exposure: null, owner: 'platform' }),
        buildFinding({ id: 5, exposure: null, owner: 'self' }),
      ]),
    ).toEqual({ exposure: true, owners: ['self', 'platform', 'third-party'] })
  })
})
