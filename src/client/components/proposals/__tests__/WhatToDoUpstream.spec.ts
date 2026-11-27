import { type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import type { ProposalFix } from '#core/proposal.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import { buildProposal, buildProposalDetail } from '@/__tests__/proposalDetailBuilders'
import ProposalSections from '@/components/proposals/ProposalSections.vue'
import WhatToDo from '@/components/proposals/WhatToDo.vue'

const WAITING_FOR = 'k3s release bundling traefik 3.7.17 or later'

const UPSTREAM_FIX: ProposalFix = {
  action: 'k3s: wait for a release bundling traefik 3.7.17',
  layer: 'platform',
  fixedVersion: '3.7.17',
  change: null,
  effort: 'none until the release',
  availability: 'upstream_pending',
  waitingFor: WAITING_FOR,
  interim: null,
}

const INTERIM = {
  action: 'kubectl apply -f traefik-helmchartconfig.yaml',
  steps: 'Pin the traefik image to 3.7.17 in a HelmChartConfig.',
  caveats: 'k3s upgrades may conflict, revert once k3s ships traefik 3.7.17.',
}

const REVIEW = { date: '2026-07-01T23:59:59.999Z', why: 'next k3s release' }

let wrapper: VueWrapper | null = null

/**
 * Mounts What to do on a fix_planned proposal.
 * @param {ProposalFix} fix - Fix path
 * @returns {VueWrapper} - Mounted component
 */
const mountWhatToDo = (fix: ProposalFix): VueWrapper => {
  wrapper = mountWithProviders(WhatToDo, {
    proposal: buildProposal({ verdict: 'fix_planned', justification: null, fix, review: REVIEW }),
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('What to do of an upstream_pending fix', () => {
  it('leads with what it waits for and the review date, without a workaround box', () => {
    const view = mountWhatToDo(UPSTREAM_FIX)
    const lines = view.findAll('p').map((line) => line.text())

    expect(lines[0]).toBe(`Waiting for upstream: ${WAITING_FOR}`)
    expect(lines[1]).toMatch(/^Review by /u)
    expect(view.find('.patch-action').exists()).toBe(false)
    expect(view.find('.interim-workaround').exists()).toBe(false)
    expect(view.text()).not.toContain('Urgent')
  })

  it('shows an interim workaround below it as a marked warning with a copy button', () => {
    const view = mountWhatToDo({ ...UPSTREAM_FIX, interim: INTERIM })
    const box = view.get('.interim-workaround')

    expect(box.element.tagName).toBe('ASIDE')
    expect(box.text()).toContain('Urgent: manual workaround advised. No upstream fix exists yet.')
    expect(box.text()).toContain(INTERIM.steps)
    expect(box.text()).toContain(INTERIM.caveats)
    expect(box.find('button[aria-label="Copy workaround"]').exists()).toBe(true)
    expect(view.findAll('.what-to-do > *').at(-1)?.classes()).toContain('interim-workaround')
  })

  it('keeps the patch action of an available fix and shows the chip in the header', () => {
    const available = mountWhatToDo({
      ...UPSTREAM_FIX,
      availability: 'available',
      waitingFor: null,
    })

    expect(available.find('.patch-action').exists()).toBe(true)
    expect(available.text()).not.toContain('Waiting for upstream')
    available.unmount()

    wrapper = mountWithProviders(ProposalSections, {
      detail: buildProposalDetail({
        proposal: buildProposal({
          verdict: 'fix_planned',
          justification: null,
          fix: { ...UPSTREAM_FIX, interim: INTERIM },
          review: REVIEW,
        }),
      }),
    })

    expect(wrapper.get('.proposal-header').text()).toContain('Waiting for upstream')
    expect(wrapper.get('.what-to-do').text()).toContain(`Waiting for upstream: ${WAITING_FOR}`)
  })
})
