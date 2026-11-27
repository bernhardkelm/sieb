import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetailResponse } from '#core/findingApiTypes.ts'
import type { FindingInstance } from '#core/instance.ts'
import { mountWithRouter } from '@/__tests__/mountWithRouter'
import { fetchFindingDetail } from '@/api/findingsApi'
import FindingPanel from '@/components/finding/FindingPanel.vue'

vi.mock('@/api/findingsApi', () => ({
  fetchFindingDetail: vi.fn<(id: number) => Promise<FindingDetailResponse>>(),
}))

/**
 * Builds an open instance of finding 1.
 * @param {number} id - Instance id
 * @param {Partial<FindingInstance>} overrides - Fields to set
 * @returns {FindingInstance} - Instance
 */
const instance = (id: number, overrides: Partial<FindingInstance> = {}): FindingInstance => ({
  id,
  findingId: 1,
  namespace: 'shop',
  resourceKind: 'ReplicaSet',
  resourceName: 'web-6d4f',
  container: 'web',
  imageTag: '1.27.0',
  imageDigest: null,
  package: 'libssl3',
  installedVersion: '3.0.1',
  fixedVersion: '3.0.2',
  locations: [],
  packageType: null,
  packageClass: null,
  purl: null,
  firstSeen: '2026-05-01T00:00:00.000Z',
  lastSeen: '2026-06-01T00:00:00.000Z',
  resolvedAt: null,
  ...overrides,
})

/**
 * Mounts the panel of finding 1 with the given instances.
 * @param {FindingInstance[]} instances - Instances of the detail
 * @returns {Promise<Awaited<ReturnType<typeof mountWithRouter>>['wrapper']>} - Mounted panel
 */
const openPanel = async (
  instances: FindingInstance[],
): Promise<Awaited<ReturnType<typeof mountWithRouter>>['wrapper']> => {
  vi.mocked(fetchFindingDetail).mockResolvedValue({
    finding: buildFindingView({ id: 1 }),
    instances,
    decisions: [],
    events: [],
    kev: null,
    sourceAccess: 'public',
  })
  const { wrapper } = await mountWithRouter(FindingPanel, '/inbox?finding=1')

  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.mocked(fetchFindingDetail).mockReset()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('FindingPanel found in', () => {
  it('shows the paths, the package type and a copyable PURL', async () => {
    const go = {
      package: 'stdlib',
      installedVersion: 'v1.22.7',
      packageType: 'gobinary',
      purl: 'pkg:golang/stdlib@v1.22.7',
    }
    const wrapper = await openPanel([
      instance(1, { ...go, locations: [{ target: 'bin/prometheus', pkgPath: null }] }),
      instance(2, {
        ...go,
        resourceName: 'other',
        locations: [
          { target: 'bin/prometheus', pkgPath: null },
          { target: 'usr/local/bin/promtool', pkgPath: null },
        ],
      }),
    ])
    const section = wrapper.get('[aria-labelledby="panel-found-in"]')

    expect(section.get('h3').text()).toBe('Found in')
    expect(section.findAll('.paths li').map((item) => item.text())).toEqual([
      'bin/prometheus',
      'usr/local/bin/promtool',
    ])
    expect(section.findAll('.paths li wbr')).toHaveLength(6)
    expect(section.get('.package').text()).toContain('gobinary')
    expect(section.get('.purl').text()).toContain('pkg:golang/stdlib@v1.22.7')
    expect(section.get('.purl button').attributes('aria-label')).toBe('Copy PURL')
    wrapper.unmount()
  })

  it('leaves the section out when Trivy reported no origin', async () => {
    const wrapper = await openPanel([instance(1)])

    expect(wrapper.find('[aria-labelledby="panel-found-in"]').exists()).toBe(false)
    expect(wrapper.find('[aria-labelledby="panel-instances"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
