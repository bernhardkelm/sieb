import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { CheckView } from '#core/check.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { proposalItem } from '@/__tests__/inboxItemBuilders'
import { mountOnAppRoutes } from '@/__tests__/mountOnAppRoutes'
import CheckChip from '@/components/checks/CheckChip.vue'
import FindingRow from '@/components/finding/FindingRow.vue'
import { useChecksStore } from '@/stores/checksStore'
import { useInboxStore } from '@/stores/inboxStore'

const mounted: VueWrapper[] = []

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.useRealTimers()
})

/**
 * Mounts a component on the app routes and keeps it for the cleanup.
 * @param {Component} component - Component under test
 * @param {Record<string, unknown>} props - Its props
 * @returns {Promise<VueWrapper>} - Wrapper
 */
const mountRouted = async (
  component: Component,
  props: Record<string, unknown>,
): Promise<VueWrapper> => {
  const { wrapper } = await mountOnAppRoutes(component, props)

  mounted.push(wrapper)
  return wrapper
}

/**
 * Mounts a chip.
 * @param {CheckView} check - Check
 * @returns {Promise<VueWrapper>} - Wrapper
 */
const mountChip = (check: CheckView): Promise<VueWrapper> => mountRouted(CheckChip, { check })

/**
 * Mounts a finding row for finding 1 with the given checks.
 * @param {Parameters<typeof buildChecksResponse>[0]} answer - Checks answer fields
 * @returns {Promise<VueWrapper>} - Wrapper
 */
const mountRow = async (answer: Parameters<typeof buildChecksResponse>[0]): Promise<VueWrapper> => {
  const wrapper = await mountRouted(FindingRow, {
    finding: buildFindingView({ id: 1 }),
    current: false,
    checked: false,
    isNew: false,
  })

  useChecksStore().response = buildChecksResponse(answer)
  return wrapper
}

describe('CheckChip', () => {
  it('links a done check to its proposal, and says when Claude filed none', async () => {
    const linked = await mountChip(buildCheck({ state: 'done', proposalId: 12 }))

    expect(linked.get('a').attributes('href')).toBe('/inbox/proposals/12')
    expect(linked.get('a').text()).toBe('Checked · proposal #12')

    const plain = await mountChip(buildCheck({ state: 'done', proposalId: null }))

    expect(plain.find('a').exists()).toBe(false)
    expect(plain.text()).toBe('Checked, no proposal')
  })

  it('counts the elapsed time of a running check every second', async () => {
    vi.useFakeTimers({ now: new Date('2026-06-01T12:00:00.000Z') })
    const wrapper = await mountChip(
      buildCheck({ state: 'running', phase: 'reporting', startedAt: '2026-06-01T11:59:50.000Z' }),
    )

    expect(wrapper.text()).toBe('Checking · reporting · 10s')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(wrapper.text()).toBe('Checking · reporting · 12s')
  })
})

describe('FindingRow check chip', () => {
  it('shows a queued check next to the Inbox marker', async () => {
    const wrapper = await mountRow({ queued: [buildCheck({ findingId: 1, position: 2 })] })

    useInboxStore().items = [proposalItem(5, { vulnId: buildFindingView().vulnId })]
    await flushPromises()

    const title = wrapper.get('.title')

    expect(title.find('[data-check-state="queued"]').text()).toBe('Queued · #2')
    expect(title.find('[data-inbox-item]').exists()).toBe(true)
  })

  it('shows a failed check, but no finished one, and nothing with the feature off', async () => {
    const failed = await mountRow({ recent: [buildCheck({ findingId: 1, state: 'failed' })] })

    await flushPromises()
    expect(failed.get('.title [data-check-state]').text()).toBe('Check failed')

    useChecksStore().response = buildChecksResponse({
      recent: [buildCheck({ findingId: 1, state: 'done', proposalId: 3 })],
    })
    await flushPromises()
    expect(failed.find('[data-check-state]').exists()).toBe(false)

    useChecksStore().response = buildChecksResponse({
      enabled: false,
      queued: [buildCheck({ findingId: 1 })],
    })
    await flushPromises()
    expect(failed.find('[data-check-state]').exists()).toBe(false)
  })
})
