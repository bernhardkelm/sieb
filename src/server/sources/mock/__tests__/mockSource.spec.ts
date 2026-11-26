// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { FindingKey } from '#core/finding.ts'
import { findingKey } from '#core/instanceKey.ts'
import type { SourceSnapshot } from '#core/sourceSnapshot.ts'
import { createMockSource, MOCK_FIXTURES_DIR } from '#server/sources/mock/mockSource.ts'

/**
 * Returns the finding keys of a snapshot.
 * @param {SourceSnapshot} snapshot - Snapshot
 * @returns {Set<string>} - Keys
 */
const keysOf = (snapshot: SourceSnapshot): Set<string> =>
  new Set(snapshot.instances.map((instance) => findingKey(instance.vulnId, instance.imageRef)))

describe('createMockSource', () => {
  it('serves the generated fixtures and alternates base and next', async () => {
    const source = createMockSource({ clock: () => new Date('2026-06-01T00:00:00.000Z') })
    const base = await source.fetchSnapshot()
    const next = await source.fetchSnapshot()
    const again = await source.fetchSnapshot()
    const resolved = JSON.parse(
      readFileSync(join(MOCK_FIXTURES_DIR, 'next', 'resolved.json'), 'utf8'),
    ) as FindingKey[]
    const baseKeys = keysOf(base)
    const nextKeys = keysOf(next)

    expect(baseKeys.size).toBeGreaterThan(250)
    expect(base.kevIds?.length).toBeGreaterThan(0)
    expect(resolved.length).toBeGreaterThan(0)
    expect(resolved.every((key) => baseKeys.has(findingKey(key.vulnId, key.imageRef)))).toBe(true)
    expect(resolved.some((key) => nextKeys.has(findingKey(key.vulnId, key.imageRef)))).toBe(false)
    expect([...nextKeys].filter((key) => !baseKeys.has(key)).length).toBeGreaterThan(0)
    expect(next.kevIds?.length).toBe((base.kevIds?.length ?? 0) + 1)
    expect(keysOf(again)).toEqual(baseKeys)
  })

  it('covers every exposure with unknown, the owners and severities, Unknown without score included', async () => {
    const { instances } = await createMockSource({ clock: () => new Date() }).fetchSnapshot()

    expect(new Set(instances.map((instance) => instance.exposure))).toEqual(
      new Set(['public', 'gated', 'internal', null]),
    )
    expect(new Set(instances.map((instance) => instance.owner))).toEqual(
      new Set(['self', 'platform', 'third-party']),
    )
    expect(
      instances.some((instance) => instance.severity === 'Unknown' && instance.score === null),
    ).toBe(true)
    expect(instances.every((instance) => instance.fixedVersion !== null)).toBe(true)
  })
})
