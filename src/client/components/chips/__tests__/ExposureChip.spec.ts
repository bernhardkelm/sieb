import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import { EXPOSURE_MEANINGS } from '#core/exposureMeaning.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import ExposureChip from '@/components/chips/ExposureChip.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ExposureChip', () => {
  it('explains each tier in its tooltip', () => {
    for (const exposure of ['public', 'gated', 'internal'] as const) {
      const wrapper = mountWithProviders(ExposureChip, { exposure })

      expect(wrapper.getComponent(HintTooltip).props('text')).toBe(EXPOSURE_MEANINGS[exposure])
      expect(wrapper.get(`[data-exposure="${exposure}"]`).attributes('tabindex')).toBeUndefined()
      wrapper.unmount()
    }
  })

  it('opens the tooltip on focus and describes the chip with it when focusable', async () => {
    const wrapper = mountWithProviders(ExposureChip, { exposure: 'gated', focusable: true })
    const chip = wrapper.get('[data-exposure="gated"]')

    expect(chip.attributes('tabindex')).toBe('0')
    await chip.trigger('focus')
    await flushPromises()

    const tooltipId = chip.attributes('aria-describedby')

    expect(tooltipId).toBeTruthy()
    expect(document.getElementById(tooltipId ?? '')?.textContent).toContain('IP allowlist')
    wrapper.unmount()
  })
})
