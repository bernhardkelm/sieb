import { describe, expect, it } from 'vitest'

import { buildCheck } from '@/__tests__/checkBuilders'
import { checkFinishNotice } from '@/format/checkFinishText'

describe('checkFinishNotice', () => {
  it('names the CVE, the image and the proposal of a done check', () => {
    expect(checkFinishNotice(buildCheck({ state: 'done', proposalId: 12 }))).toEqual({
      title: 'Auto-check done: CVE-2099-10001 · nginx',
      description: 'Proposal #12',
      proposalId: 12,
      failed: false,
    })
    expect(checkFinishNotice(buildCheck({ state: 'done' })).description).toBe(
      'Checked, no proposal',
    )
  })

  it('names the reason of a failed check, a fallback without one', () => {
    expect(checkFinishNotice(buildCheck({ state: 'failed', error: 'Image pull failed' }))).toEqual({
      title: 'Auto-check failed: CVE-2099-10001',
      description: 'Image pull failed',
      proposalId: null,
      failed: true,
    })
    expect(checkFinishNotice(buildCheck({ state: 'failed' })).description).toBe(
      'The worker gave no reason.',
    )
  })
})
