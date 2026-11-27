import { describe, expect, it } from 'vitest'

import {
  buildDecisionView,
  buildImageFacts,
  buildProposal,
  buildProposalDetail,
  IMAGE,
  OWN_IMAGE,
  PROPOSED_VALUES,
} from '@/__tests__/proposalDetailBuilders'
import { acceptEffects } from '@/components/proposals/acceptEffects'

/**
 * Returns the effect texts of a detail.
 * @param {Parameters<typeof buildProposalDetail>[0]} overrides - Detail fields to set
 * @returns {string[]} - Texts
 */
const texts = (overrides: Parameters<typeof buildProposalDetail>[0] = {}): string[] =>
  acceptEffects(buildProposalDetail(overrides)).map((effect) => effect.text)

describe('acceptEffects', () => {
  it('mutes alerts and removes undecided findings from Triage', () => {
    const lines = texts({
      proposal: buildProposal({ imageRefs: [IMAGE, OWN_IMAGE] }),
      images: [buildImageFacts(), buildImageFacts({ imageRef: OWN_IMAGE })],
    })

    expect(lines[0]).toBe('Mutes alerts for 2 images')
    expect(lines[1]).toBe('Removes 2 findings from Triage')
    expect(lines.at(-1)).toMatch(/^Expires /)
  })

  it('names a current decision with another status that accepting replaces', () => {
    const lines = texts({
      images: [buildImageFacts({ decision: buildDecisionView('fix_planned') })],
    })

    expect(lines).toContain(
      'Replaces the current decision Fix planned → Not affected on image nginx',
    )
    expect(lines.some((line) => line.startsWith('Removes'))).toBe(false)
  })

  it('counts an expired decision as back in Triage and as replaced', () => {
    const view = buildDecisionView('not_affected')
    const lines = texts({
      images: [
        buildImageFacts({
          decision: {
            ...view,
            effective: { state: 'expired', expiresAt: '2026-01-01T00:00:00.000Z' },
          },
        }),
      ],
    })

    expect(lines).toContain('Removes 1 finding from Triage')
    expect(lines).toContain(
      'Replaces the current decision Not affected (expired) → Not affected on image nginx',
    )
  })

  it('tells an all-images proposal also covers future images and keeps image decisions', () => {
    const lines = texts({
      proposal: buildProposal({ scope: 'all', imageRefs: null }),
      images: [
        buildImageFacts(),
        buildImageFacts({ imageRef: OWN_IMAGE, decision: buildDecisionView('fix_planned') }),
      ],
      allScopeDecision: buildDecisionView('accepted', { scope: 'all', imageRef: null }),
    })

    expect(lines).toContain('Mutes alerts for 1 image')
    expect(lines).toContain('Applies to all images of this CVE, including future ones')
    expect(lines).toContain('1 image keeps its own image decision')
    expect(lines).toContain('Replaces the current decision Accepted → Not affected on all images')
  })

  it('says alerts keep firing for fix planned and that an image decision overrides all images', () => {
    const detail = buildProposalDetail({
      proposal: buildProposal({ verdict: 'needs_patch', justification: null }),
      images: [
        buildImageFacts({
          decision: buildDecisionView('accepted', { scope: 'all', imageRef: null }),
        }),
      ],
    })
    const lines = acceptEffects({
      ...detail,
      decisionValues: { ...PROPOSED_VALUES, status: 'fix_planned', expiresAt: null },
    }).map((effect) => effect.text)

    expect(lines[0]).toBe('Alerts keep firing, Fix planned only takes the findings out of Triage')
    expect(lines).toContain(
      'Overrides the all-images decision Accepted with Fix planned on image nginx',
    )
    expect(lines.at(-1)).toBe('Never expires')
  })
})
