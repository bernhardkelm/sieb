import { describe, expect, it } from 'vitest'

import { bulkTargetsFor } from '@/components/decision/bulkTargets'

const FINDINGS = [
  { id: 1, vulnId: 'CVE-1', imageRef: 'r/nginx' },
  { id: 2, vulnId: 'CVE-2', imageRef: 'r/nginx' },
  { id: 3, vulnId: 'CVE-1', imageRef: 'r/redis' },
]

describe('bulkTargetsFor', () => {
  it('groups checked findings per CVE', () => {
    expect(bulkTargetsFor(FINDINGS, new Set([1, 2, 3]), 1)).toEqual([
      { vulnId: 'CVE-1', imageRefs: ['r/nginx', 'r/redis'] },
      { vulnId: 'CVE-2', imageRefs: ['r/nginx'] },
    ])
  })

  it('targets all open images of the cursor CVE without checked findings', () => {
    expect(bulkTargetsFor(FINDINGS, new Set(), 3)).toEqual([
      { vulnId: 'CVE-1', imageRefs: 'all-open' },
    ])
  })

  it('has no target without cursor and checked findings', () => {
    expect(bulkTargetsFor(FINDINGS, new Set(), null)).toEqual([])
  })
})
