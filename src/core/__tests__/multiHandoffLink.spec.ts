import { describe, expect, it } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { PROMPT_LINK_LIMIT } from '#core/handoffLinks.ts'
import { multiLinkPrompt } from '#core/multiHandoffLink.ts'
import { MULTI_HANDOFF_CAP, buildMultiHandoffPrompts } from '#core/multiHandoffPrompt.ts'
import type { MultiHandoffFinding } from '#core/multiHandoffRepositoryLine.ts'
import { selectionHandoffTexts } from '#core/selectionHandoff.ts'

/**
 * Builds findings of distinct CVEs on distinct images.
 * @param {number} count - Number of findings
 * @returns {MultiHandoffFinding[]} - Findings with ids from 1
 */
const findings = (count: number): MultiHandoffFinding[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    vulnId: `CVE-2099-${10_000 + index}`,
    imageRef: `index.docker.io/library/image-${index}:1.2.3`,
    owner: 'third-party',
  }))

/**
 * Returns the encoded length of a prompt as a link carries it.
 * @param {string | null} prompt - Prompt
 * @returns {number} - Encoded length
 */
const encoded = (prompt: string | null): number => encodeURIComponent(prompt ?? '').length

describe('multiLinkPrompt', () => {
  it('carries the full prompt while it fits', () => {
    const selection = findings(3)
    const link = multiLinkPrompt(selection, 'chat')

    expect(link).toEqual({ prompt: buildMultiHandoffPrompts(selection).chat, max: 3 })
    expect(encoded(link.prompt)).toBeLessThan(PROMPT_LINK_LIMIT)
  })

  it('drops the images before giving up on a link', () => {
    const selection = findings(9)
    const link = multiLinkPrompt(selection, 'chat')

    expect(encoded(buildMultiHandoffPrompts(selection).chat)).toBeGreaterThanOrEqual(
      PROMPT_LINK_LIMIT,
    )
    expect(link.prompt).toContain('\n#9 CVE-2099-10008\n')
    expect(link.prompt).not.toContain('docker.io')
    expect(encoded(link.prompt)).toBeLessThan(PROMPT_LINK_LIMIT)
  })

  it('refuses a selection too long for a link and names how many fit', () => {
    const link = multiLinkPrompt(findings(40), 'chat')

    expect(link.prompt).toBeNull()
    expect(link.max).toBeGreaterThan(9)
    expect(link.max).toBeLessThan(40)
    expect(multiLinkPrompt(findings(link.max), 'chat').prompt).not.toBeNull()
    expect(multiLinkPrompt(findings(link.max + 1), 'chat').prompt).toBeNull()
  })

  it('never links a capped selection', () => {
    const link = multiLinkPrompt(findings(MULTI_HANDOFF_CAP + 1), 'code')

    expect(link.prompt).toBeNull()
    expect(link.max).toBeLessThan(MULTI_HANDOFF_CAP)
  })
})

describe('selectionHandoffTexts', () => {
  it('returns nothing without a selection', () => {
    expect(selectionHandoffTexts([])).toBeNull()
  })

  it('uses the single-finding prompt with the row packages for one finding', () => {
    const texts = selectionHandoffTexts([
      buildFindingView({ id: 7, vulnId: 'CVE-2099-1', owner: 'self', packages: ['openssl'] }),
    ])

    expect(texts?.prompts.chat).toMatch(/^Triage sieb finding #7: CVE-2099-1 in .* \(openssl\)\./)
    expect(texts?.links.chat.prompt).toBe(texts?.prompts.chat)
    expect(texts?.command).toMatch(/^claude 'Triage sieb finding #7/)
    expect(texts).toMatchObject({ listed: 1, total: 1 })
  })

  it('caps the listed findings and keeps the total', () => {
    const texts = selectionHandoffTexts(
      findings(MULTI_HANDOFF_CAP + 3).map((entry) => buildFindingView(entry)),
    )

    expect(texts).toMatchObject({ listed: MULTI_HANDOFF_CAP, total: MULTI_HANDOFF_CAP + 3 })
    expect(texts?.links.chat.prompt).toBeNull()
  })
})
