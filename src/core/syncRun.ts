import type { SourceKind } from '#core/types.ts'

export type SyncStatus = 'running' | 'success' | 'failed'

export interface SyncCounts {
  findingsSeen: number
  findingsNew: number
  findingsResolved: number
  findingsReappeared: number
  instancesSeen: number
  instancesNew: number
  instancesResolved: number
  decisionEvents: number // expired and reopened events written by the sync
}

export interface SyncRun {
  id: number
  source: SourceKind
  status: SyncStatus
  startedAt: string
  finishedAt: string | null
  fetchedAt: string | null
  error: string | null
  counts: SyncCounts | null // null while running and after a failure
}
