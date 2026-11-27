import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { EXPOSURE_CAVEAT_SHORT, EXPOSURE_MEANINGS } from '#core/exposureMeaning.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import FindingHeader from '@/components/finding/FindingHeader.vue'
import { useLabelsStore } from '@/stores/labelsStore'

afterEach(() => {
  document.body.innerHTML = ''
})

/**
 * Mounts the header of a finding with the given exposure while findings carry exposure labels.
 * @param {'public' | 'gated' | 'internal' | null} exposure - Exposure of the finding
 * @param {boolean} labelled - Whether any open finding carries an exposure label
 * @returns {Promise<ReturnType<typeof mountWithProviders>>} - Mounted header
 */
const mountHeader = async (
  exposure: 'public' | 'gated' | 'internal' | null,
  labelled = true,
): Promise<ReturnType<typeof mountWithProviders>> => {
  const wrapper = mountWithProviders(FindingHeader, { finding: buildFindingView({ exposure }) })

  useLabelsStore().data = { exposure: labelled, owners: [], kev: 'cisa' }
  await nextTick()
  return wrapper
}

describe('FindingHeader exposure meaning', () => {
  it('shows the meaning of the tier once with the short caveat', async () => {
    const wrapper = await mountHeader('internal')
    const line = wrapper.get('.exposure-meaning')

    expect(wrapper.findAll('.exposure-meaning')).toHaveLength(1)
    expect(line.text()).toBe(
      `Internal exposure: ${EXPOSURE_MEANINGS.internal} ${EXPOSURE_CAVEAT_SHORT}`,
    )
    expect(wrapper.get('.chips [data-exposure="internal"]').text()).toBe('Internal')
    wrapper.unmount()
  })

  it('explains an unlabelled finding as possibly reachable', async () => {
    const wrapper = await mountHeader(null)

    expect(wrapper.get('.exposure-meaning').text()).toContain(
      `Unknown exposure: ${EXPOSURE_MEANINGS.unknown}`,
    )
    expect(wrapper.find('.chips [data-exposure]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('hides the line while no open finding carries an exposure label', async () => {
    const wrapper = await mountHeader('public', false)

    expect(wrapper.find('.exposure-meaning').exists()).toBe(false)
    wrapper.unmount()
  })
})
