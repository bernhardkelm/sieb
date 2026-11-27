import type { DatabaseSync } from 'node:sqlite'

import { z } from 'zod'

import { latestSyncRun } from '#server/db/syncRunRepository.ts'

export const lastSyncSchema = z
  .object({
    finishedAt: z.string().describe('end of the latest successful sync'),
    fetchedAt: z.string().nullable().describe('when that sync read the scan results'),
  })
  .nullable()
  .describe('latest successful sync, null before the first one')

export type LastSync = z.infer<typeof lastSyncSchema>

/**
 * Reads when sieb last synced successfully, the freshness of every answer.
 * @param {DatabaseSync} db - Open database
 * @returns {LastSync} - Latest successful sync, null before the first one
 */
export const readLastSync = (db: DatabaseSync): LastSync => {
  const run = latestSyncRun(db, { succeeded: true })

  return run?.finishedAt ? { finishedAt: run.finishedAt, fetchedAt: run.fetchedAt } : null
}
