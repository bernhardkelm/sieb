import { describe, expect, it } from 'vitest'

import {
  buildImageFacts,
  buildProposal,
  buildProposalDetail,
  OWN_IMAGE,
} from '@/__tests__/proposalDetailBuilders'
import {
  isLongText,
  proposerLine,
  resolutionLine,
  safeReferences,
  verdictLabel,
} from '@/components/proposals/proposalText'
import { isWeakEvidence, uninspectedPrivateImages } from '@/components/proposals/proposalWarnings'

describe('proposalText', () => {
  it('labels a not affected verdict with its justification', () => {
    expect(verdictLabel('not_affected', 'vulnerable_code_not_in_execute_path')).toBe(
      'Not affected · vulnerable code not in execute path',
    )
    expect(verdictLabel('needs_patch', null)).toBe('Needs patch')
  })

  it('names the proposer, the agent and the client label once', () => {
    expect(proposerLine({ proposedBy: 'alice', agent: 'Claude Code', clientLabel: 'laptop' })).toBe(
      'Proposed by alice via Claude Code (laptop)',
    )
    expect(proposerLine({ proposedBy: 'alice', agent: null, clientLabel: 'claude.ai' })).toBe(
      'Proposed by alice via claude.ai',
    )
  })

  it('describes how a closed proposal ended', () => {
    expect(
      resolutionLine(
        buildProposal({ state: 'accepted', resolution: 'accepted_edited', resolvedBy: 'bob' }),
      ),
    ).toBe('Accepted with edits by bob')
    expect(
      resolutionLine(
        buildProposal({ state: 'superseded', resolution: 'finding_resolved', resolvedBy: 'sieb' }),
      ),
    ).toBe('The findings resolved')
  })

  it('keeps only http and https references', () => {
    expect(
      safeReferences([
        'https://example.org/a',
        'http://example.org/b',
        'javascript:alert(1)',
        'data:text/html,x',
        'not a url',
      ]),
    ).toEqual(['https://example.org/a', 'http://example.org/b'])
  })

  it('normalizes references, a lookalike host shows in punycode', () => {
    expect(
      safeReferences([
        'https://nvd.n\u0456st.gov/x',
        'HTTPS://Example.org/a',
        'https://example.org/a',
      ]),
    ).toEqual(['https://nvd.xn--nst-jhd.gov/x', 'https://example.org/a'])
  })

  it('collapses long or many-line text', () => {
    expect(isLongText('short')).toBe(false)
    expect(isLongText('x'.repeat(481))).toBe(true)
    expect(isLongText('1\n2\n3\n4\n5\n6\n7')).toBe(true)
  })
})

describe('proposalWarnings', () => {
  it('flags a not affected verdict resting on the advisory alone', () => {
    expect(
      isWeakEvidence(
        buildProposalDetail({ proposal: buildProposal({ evidenceBasis: ['advisory'] }) }),
      ),
    ).toBe(true)
    expect(
      isWeakEvidence(
        buildProposalDetail({ proposal: buildProposal({ evidenceBasis: ['advisory', 'image'] }) }),
      ),
    ).toBe(false)
    expect(
      isWeakEvidence(
        buildProposalDetail({
          proposal: buildProposal({
            verdict: 'accepted',
            justification: null,
            evidenceBasis: ['advisory'],
          }),
        }),
      ),
    ).toBe(false)
  })

  it('lists private images unless the own source was checked', () => {
    const images = [buildImageFacts({ imageRef: OWN_IMAGE, sourceAccess: 'private' })]

    expect(uninspectedPrivateImages(buildProposalDetail({ images }))).toEqual([OWN_IMAGE])
    expect(
      uninspectedPrivateImages(
        buildProposalDetail({ images, proposal: buildProposal({ evidenceBasis: ['own_source'] }) }),
      ),
    ).toEqual([])
    expect(uninspectedPrivateImages(buildProposalDetail())).toEqual([])
  })
})
