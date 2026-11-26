import type { DatabaseSync } from 'node:sqlite'

import { aggregateFinding, groupByFinding } from '#core/findingAggregation.ts'
import { findingKey, instanceKey } from '#core/instanceKey.ts'
import { mergeDuplicateInstances } from '#core/mergeDuplicateInstances.ts'
import type { SourceSnapshot } from '#core/sourceSnapshot.ts'
import type { SyncCounts } from '#core/syncRun.ts'
import {
  readStoredFindings,
  readStoredInstances,
  type StoredKey,
} from '#server/db/snapshotReads.ts'
import { createSnapshotWriter } from '#server/db/snapshotWrites.ts'
import { latestSyncRun } from '#server/db/syncRunRepository.ts'

export type SnapshotCounts = Omit<SyncCounts, 'decisionEvents'>

/**
 * Resolves every stored open row the snapshot did not see.
 * @param {Iterable<StoredKey>} stored - Stored rows
 * @param {ReadonlySet<number>} seen - Ids seen in the snapshot
 * @param {(id: number) => void} resolve - Writes the resolution
 * @returns {number} - Rows resolved
 */
const resolveUnseen = (
  stored: Iterable<StoredKey>,
  seen: ReadonlySet<number>,
  resolve: (id: number) => void,
): number => {
  let resolved = 0

  for (const row of stored) {
    if (row.resolvedAt === null && !seen.has(row.id)) {
      resolve(row.id)
      resolved += 1
    }
  }

  return resolved
}

/**
 * Writes a successful snapshot: inserts new findings and instances with first_seen, refreshes
 * last_seen and the aggregated fields of seen ones and clears their resolved_at, and resolves
 * every open finding and instance the snapshot lacks. Rows sharing an instance key are merged,
 * keeping every place Trivy found the package. A snapshot without a KEV list keeps the
 * stored KEV flags and inserts new findings as not listed. kev_since marks findings that became
 * KEV listed, but not the findings of the initial import, by default the snapshot written while
 * no earlier sync succeeded. Call it inside a transaction.
 * @param {DatabaseSync} db - Open database
 * @param {SourceSnapshot} snapshot - Snapshot of a successful fetch
 * @param {Date} now - Time recorded as first_seen, last_seen and resolved_at
 * @param {{ initialImport?: boolean }} options - Overrides whether this is the initial import
 * @returns {SnapshotCounts} - What changed
 */
export const applySnapshot = (
  db: DatabaseSync,
  snapshot: SourceSnapshot,
  now: Date,
  {
    initialImport = latestSyncRun(db, { succeeded: true }) === null,
  }: { initialImport?: boolean } = {},
): SnapshotCounts => {
  const at = now.toISOString()
  const kevIds = new Set(snapshot.kevIds ?? [])
  const writer = createSnapshotWriter(db, initialImport)
  const storedFindings = readStoredFindings(db, findingKey)
  const storedInstances = readStoredInstances(db)
  const seenFindings = new Set<number>()
  const seenInstances = new Set<number>()
  const counts: SnapshotCounts = {
    findingsSeen: 0,
    findingsNew: 0,
    findingsResolved: 0,
    findingsReappeared: 0,
    instancesSeen: 0,
    instancesNew: 0,
    instancesResolved: 0,
  }

  for (const group of groupByFinding(snapshot.instances)) {
    const stored = storedFindings.get(findingKey(group.vulnId, group.imageRef))
    const aggregated = aggregateFinding(group.instances, kevIds)
    const fields =
      snapshot.kevIds === null ? { ...aggregated, kev: stored?.kev ?? false } : aggregated
    const findingId = stored ? stored.id : writer.insertFinding(group, fields, at)

    if (stored) {
      writer.updateFinding(stored.id, fields, at)
      counts.findingsReappeared += stored.resolvedAt === null ? 0 : 1
    } else {
      counts.findingsNew += 1
    }

    seenFindings.add(findingId)

    const instances = storedInstances.get(findingId)
    const merged = mergeDuplicateInstances(group.instances)

    for (const instance of merged) {
      const key = instanceKey(instance)
      const storedInstance = instances?.get(key)

      if (storedInstance) {
        writer.updateInstance(storedInstance.id, instance, at)
        seenInstances.add(storedInstance.id)
      } else {
        writer.insertInstance(findingId, key, instance, at)
        counts.instancesNew += 1
      }
    }

    counts.instancesSeen += merged.length
  }

  counts.findingsSeen = seenFindings.size
  counts.findingsResolved = resolveUnseen(storedFindings.values(), seenFindings, (id) => {
    writer.resolveFinding(id, at)
  })
  counts.instancesResolved = resolveUnseen(
    [...storedInstances.values()].flatMap((instances) => [...instances.values()]),
    seenInstances,
    (id) => {
      writer.resolveInstance(id, at)
    },
  )

  return counts
}
