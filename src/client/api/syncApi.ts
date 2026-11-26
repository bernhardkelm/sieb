import type { SyncStatusResponse } from '#core/apiTypes.ts'
import type { SyncRun } from '#core/syncRun.ts'
import { apiRequest } from '@/api/apiRequest'

export const SYNC_URL = '/api/sync'

/**
 * Fetches the latest and the latest finished sync run.
 * @returns {Promise<SyncStatusResponse>} - Sync status
 */
export const fetchSyncStatus = (): Promise<SyncStatusResponse> => apiRequest(SYNC_URL)

/**
 * Runs a sync, or joins the running one, and waits for it to finish.
 * @returns {Promise<SyncRun>} - Finished run, failed runs included
 */
export const triggerSync = (): Promise<SyncRun> => apiRequest(SYNC_URL, 'POST')
