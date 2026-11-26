// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createSource } from '#server/sources/createSource.ts'
import {
  DEFAULT_PROMETHEUS_SERVICE,
  DEFAULT_SOURCE_QUERIES,
} from '#server/sources/sourceQueries.ts'

const CONFIG = {
  kubeContext: null,
  prometheusService: DEFAULT_PROMETHEUS_SERVICE,
  prometheusUrl: 'http://prometheus:9090',
  queries: DEFAULT_SOURCE_QUERIES,
  kevSource: 'cisa' as const,
}

/**
 * Returns the current time.
 * @returns {Date} - Now
 */
const clock = (): Date => new Date()

/**
 * Answers no stored catalog.
 * @returns {null} - No catalog
 */
const noCatalog = (): null => null

describe('createSource', () => {
  it('selects the implementation by SIEB_SOURCE', () => {
    expect(createSource({ ...CONFIG, source: 'mock' }, clock, noCatalog).kind).toBe('mock')
    expect(createSource({ ...CONFIG, source: 'kubectl' }, clock, noCatalog).kind).toBe('kubectl')
    expect(createSource({ ...CONFIG, source: 'incluster' }, clock, noCatalog).kind).toBe(
      'incluster',
    )
  })

  it('takes the mock KEV list from its fixtures for cisa and prometheus, none clears it', async () => {
    /**
     * Fetches one mock snapshot with a KEV source.
     * @param {'cisa' | 'prometheus' | 'none'} kevSource - KEV source
     * @returns {Promise<string[] | null>} - KEV ids of the snapshot
     */
    const kevIdsWith = async (
      kevSource: 'cisa' | 'prometheus' | 'none',
    ): Promise<string[] | null> =>
      (
        await createSource({ ...CONFIG, source: 'mock', kevSource }, clock, () => [
          'CVE-1',
        ]).fetchSnapshot()
      ).kevIds

    expect((await kevIdsWith('cisa'))?.length).toBeGreaterThan(1)
    expect(await kevIdsWith('prometheus')).toEqual(await kevIdsWith('cisa'))
    expect(await kevIdsWith('none')).toEqual([])
  })
})
