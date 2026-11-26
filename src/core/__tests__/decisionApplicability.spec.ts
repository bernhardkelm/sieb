import { describe, expect, it } from 'vitest'

import { decisionCovers, selectApplicableDecision } from '#core/decisionApplicability.ts'

import { buildDecision, buildFinding } from './coreBuilders.ts'

describe('decisionCovers', () => {
  it('matches vuln_id and image_ref for scope image', () => {
    const decision = buildDecision()

    expect(decisionCovers(decision, buildFinding())).toBe(true)
    expect(decisionCovers(decision, buildFinding({ imageRef: 'quay.io/x/y' }))).toBe(false)
    expect(decisionCovers(decision, buildFinding({ vulnId: 'CVE-2025-2' }))).toBe(false)
  })

  it('matches every image for scope all', () => {
    const decision = buildDecision({ scope: 'all', imageRef: null })

    expect(decisionCovers(decision, buildFinding({ imageRef: 'quay.io/x/y' }))).toBe(true)
    expect(decisionCovers(decision, buildFinding({ vulnId: 'CVE-2025-2' }))).toBe(false)
  })
})

describe('selectApplicableDecision', () => {
  const all = buildDecision({ id: 1, scope: 'all', imageRef: null })
  const image = buildDecision({ id: 2 })

  it('prefers the image-scoped decision over the all-scope one', () => {
    expect(selectApplicableDecision([image, all], buildFinding())).toBe(image)
    expect(selectApplicableDecision([all, image], buildFinding())).toBe(image)
  })

  it('falls back to the all-scope decision for other images', () => {
    expect(selectApplicableDecision([image, all], buildFinding({ imageRef: 'quay.io/x' }))).toBe(
      all,
    )
  })

  it('ignores revoked decisions', () => {
    const revoked = { ...image, revokedAt: '2026-05-02T00:00:00.000Z' }

    expect(selectApplicableDecision([revoked, all], buildFinding())).toBe(all)
    expect(selectApplicableDecision([revoked], buildFinding())).toBeNull()
  })

  it('picks the newest decision among equal scopes', () => {
    const newer = buildDecision({ id: 5 })

    expect(selectApplicableDecision([newer, image], buildFinding())).toBe(newer)
  })
})
