import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import {
  daysFromNow,
  expiringItem,
  kevItem,
  proposalItem,
  reopenedItem,
} from '@/__tests__/inboxItemBuilders'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import InboxRow from '@/components/inbox/InboxRow.vue'

let wrapper: VueWrapper | null = null

/**
 * Mounts a row for an item.
 * @param {InboxItem} item - Item
 * @param {Record<string, unknown>} listeners - Event listeners as onX props
 * @returns {VueWrapper} - Wrapper
 */
const mountRow = (item: InboxItem, listeners: Record<string, unknown> = {}): VueWrapper => {
  wrapper = mountWithProviders(InboxRow, {
    item,
    current: false,
    checked: false,
    hideKev: false,
    ...listeners,
  })
  return wrapper
}

/**
 * Returns the text of a cell.
 * @param {VueWrapper} row - Row wrapper
 * @param {string} selector - Cell selector
 * @returns {string} - Text
 */
const cell = (row: VueWrapper, selector: string): string => row.get(selector).text()

/**
 * Returns the parts of the detail cell, the texts of its chips and labels joined by a space.
 * @param {VueWrapper} row - Row wrapper
 * @returns {string} - Text
 */
const detail = (row: VueWrapper): string =>
  row
    .findAll('.detail > *')
    .map((part) => part.text())
    .join(' ')

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('InboxRow', () => {
  it('shows a proposal with its verdict, confidence, image count and title', () => {
    const row = mountRow(proposalItem(1))

    expect(cell(row, '.kind')).toBe('Proposal')
    expect(cell(row, '.vuln-id')).toBe('CVE-2025-1001')
    expect(cell(row, '.scope')).toBe('3 images')
    expect(detail(row)).toBe('Not affected High confidence Claude Code (CLI)')
    expect(cell(row, '.title')).toBe('Heap overflow in a parser')
    expect(cell(row, '.at')).toBe('1d ago')
    expect(row.find('.row-checkbox').exists()).toBe(true)
    expect(row.find('.seen-button').exists()).toBe(false)
  })

  it('shows the patch action of a patch verdict after the chips as muted text', () => {
    const action = 'upgrade libxslt to 1.1.43-r4 (rebuild on the current base)'
    const row = mountRow(
      proposalItem(1, { verdict: 'needs_patch', confidence: 'medium', patchAction: action }),
    )
    const patch = row.get('.detail .patch')

    expect(detail(row)).toBe(`Needs patch Medium confidence Claude Code (CLI) ${action}`)
    expect(patch.attributes('title')).toBe(action)
  })

  it('names the client of a proposal, an Auto-check and an unknown client by their labels', () => {
    const tagOf = (overrides: Parameters<typeof proposalItem>[1]): string => {
      const text = mountRow(proposalItem(1, overrides)).get('.proposal-client-tag').text()

      wrapper?.unmount()
      return text
    }

    expect(tagOf({ clientKind: 'claude_app', clientLabel: 'claude.ai' })).toBe('Claude app')
    expect(tagOf({ clientKind: 'auto_check', clientLabel: 'Auto-check #4' })).toBe('Auto-check #4')
    expect(tagOf({ clientKind: null, clientLabel: 'laptop', agent: 'Cursor' })).toBe(
      'Cursor (laptop)',
    )
  })

  it('shows a re-opened decision with its reason and status', () => {
    const row = mountRow(reopenedItem(2, { reopenReason: 'kev_listed' }))

    expect(cell(row, '.kind')).toBe('Re-opened')
    expect(cell(row, '.scope')).toBe('nginx')
    expect(detail(row)).toBe('Listed in KEV Accepted')
    expect(row.find('.row-checkbox').exists()).toBe(false)
    expect(row.find('.seen-button').exists()).toBe(false)
  })

  it('shows an expiring decision with the days left and its status', () => {
    const row = mountRow(expiringItem(3, { at: daysFromNow(5) }))

    expect(cell(row, '.kind')).toBe('Expiring')
    expect(detail(row)).toBe('Expires in 5 days Not affected')
    expect(row.find('.row-checkbox').exists()).toBe(true)
  })

  it('shows a new KEV listing as undecided or with its decision status', () => {
    const row = mountRow(kevItem(4))

    expect(cell(row, '.kind')).toBe('New KEV')
    expect(detail(row)).toBe('KEV listed 3 days ago Undecided')
    expect(row.find('.kev .chip').text()).toBe('KEV')

    wrapper?.unmount()

    const decided = mountRow(kevItem(5, { at: daysFromNow(-1), decisionStatus: 'fix_planned' }))

    expect(detail(decided)).toBe('KEV listed yesterday Fix planned')
  })

  it('marks a seeable item as seen from its button without selecting the row', async () => {
    const onSeen = vi.fn<() => void>()
    const onSelect = vi.fn<() => void>()
    const row = mountRow(kevItem(4), { onSeen, onSelect })

    await row.get('.seen-button').trigger('click')

    expect(onSeen).toHaveBeenCalledOnce()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
