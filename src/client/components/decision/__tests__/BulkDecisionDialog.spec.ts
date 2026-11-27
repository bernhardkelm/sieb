import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import BulkDecisionDialog from '@/components/decision/BulkDecisionDialog.vue'
import type { BulkTarget } from '@/components/decision/bulkTargets'
import type { DecisionFormValue } from '@/components/decision/decisionFormModel'

const bulkDecide = vi.fn<(targets: BulkTarget[], value: DecisionFormValue) => Promise<unknown>>()

vi.mock('@/composables/useDecisionCommands', () => ({
  useDecisionCommands: () => ({ bulkDecide }),
}))

const TARGETS: BulkTarget[] = [
  {
    vulnId: 'CVE-2025-1000',
    imageRefs: ['index.docker.io/library/nginx', 'index.docker.io/library/redis'],
  },
]

/**
 * Mounts the open dialog attached to the document and waits for its auto focus.
 * @param {Record<string, unknown>} props - Dialog props besides open and targets
 * @returns {Promise<VueWrapper>} - Mounted dialog
 */
const mountDialog = async (props: Record<string, unknown> = {}): Promise<VueWrapper> => {
  const wrapper = mount(BulkDecisionDialog, {
    props: { open: true, targets: TARGETS, ...props },
    attachTo: document.body,
  })

  await flushPromises()
  return wrapper
}

/**
 * Returns the label of the checked status option.
 * @returns {string | undefined} - Label, undefined when none is checked
 */
const checkedStatus = (): string | undefined =>
  document.querySelector('[role="radio"][aria-checked="true"]')?.textContent?.trim()

afterEach(() => {
  bulkDecide.mockReset()
  document.body.innerHTML = ''
})

describe('BulkDecisionDialog', () => {
  it('preselects the given status and focuses the reason', async () => {
    await mountDialog({ status: 'fix_planned' })

    expect(checkedStatus()).toBe('Fix planned')
    expect(document.activeElement).toBe(document.querySelector('textarea'))
  })

  it('preselects no status without one and asks for it on Cmd+Enter', async () => {
    await mountDialog()
    const reason = document.querySelector('textarea')!

    expect(checkedStatus()).toBeUndefined()

    reason.value = 'Not reachable'
    reason.dispatchEvent(new Event('input'))
    reason.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }),
    )
    await flushPromises()

    expect(bulkDecide).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Choose a status.')
    expect(document.activeElement?.getAttribute('role')).toBe('radio')
  })

  it('decides every target on Cmd+Enter and closes', async () => {
    bulkDecide.mockResolvedValue({ created: [], skipped: [] })
    const wrapper = await mountDialog({ status: 'accepted' })
    const reason = document.querySelector('textarea')!

    reason.value = 'Not reachable'
    reason.dispatchEvent(new Event('input'))
    reason.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }),
    )
    await flushPromises()

    expect(bulkDecide).toHaveBeenCalledWith(
      TARGETS,
      expect.objectContaining({ status: 'accepted', reason: 'Not reachable', scope: 'image' }),
    )
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('done')).toHaveLength(1)
  })

  it('counts the selected images on the submit button, every open image stays all', async () => {
    const wrapper = await mountDialog()
    /**
     * Returns the label of the submit button.
     * @returns {string | undefined} - Label, undefined without the button
     */
    const submitText = (): string | undefined =>
      [...document.querySelectorAll('button[type="submit"], button')]
        .map((button) => button.textContent?.trim())
        .find((text) => text?.startsWith('Decide'))

    expect(submitText()).toBe('Decide 2')

    await wrapper.setProps({ targets: [{ vulnId: 'CVE-2025-1000', imageRefs: 'all-open' }] })
    expect(submitText()).toBe('Decide all')
  })
})
