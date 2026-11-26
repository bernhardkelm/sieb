import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { SyncStatusResponse } from '#core/apiTypes.ts'
import { errorMessage } from '@/api/apiRequest'
import { fetchSyncStatus, triggerSync } from '@/api/syncApi'
import { countOf } from '@/format/count'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { notifyError, notifySuccess } from '@/toast/toastManager'

export const SYNC_POLL_MS = 30 * 1000
export const SYNC_RUNNING_POLL_MS = 3 * 1000

/**
 * Holds the sync status, polls it and triggers syncs. A newly finished run bumps the data
 * version, so every store holding findings refetches. A failed status fetch is kept apart from
 * the outcome of the last sync, so an unreachable server does not pass for a healthy sync.
 */
export const useSyncStore = defineStore('sync', () => {
  const dataVersion = useDataVersionStore()

  const status = ref<SyncStatusResponse | null>(null)
  const triggering = ref(false)
  const fetchError = ref<string | null>(null)
  let seenFinishedId: number | null | undefined
  let timer: ReturnType<typeof setTimeout> | null = null
  let polling = 0

  const lastFinished = computed(() => status.value?.lastFinished ?? null)
  const running = computed(() => triggering.value || status.value?.running === true)
  const lastSyncAt = computed(() => lastFinished.value?.finishedAt ?? null)
  const ok = computed(() => (lastFinished.value ? lastFinished.value.status === 'success' : null))
  const lastError = computed(() => lastFinished.value?.error ?? null)
  const kevFeed = computed(() => status.value?.kevFeed ?? null)

  /**
   * Records a status answer and bumps the data version when a run finished since the last one
   * seen; the very first answer only sets the baseline.
   * @param {SyncStatusResponse} next - Status answer
   * @returns {void}
   */
  const accept = (next: SyncStatusResponse): void => {
    const finishedId = next.lastFinished?.id ?? null

    status.value = next
    fetchError.value = null

    if (seenFinishedId !== undefined && finishedId !== seenFinishedId) {
      dataVersion.bump()
    }

    seenFinishedId = finishedId
  }

  /**
   * Fetches the sync status.
   * @returns {Promise<void>} - Resolves when the status is stored or the error recorded
   */
  const refresh = async (): Promise<void> => {
    try {
      accept(await fetchSyncStatus())
    } catch (error) {
      fetchError.value = errorMessage(error)
    }
  }

  /**
   * Runs a sync and waits for it, then refreshes the status. Ignored while one is running.
   * @returns {Promise<void>} - Resolves when the sync finished
   */
  const sync = async (): Promise<void> => {
    if (running.value) {
      return
    }

    triggering.value = true

    try {
      const run = await triggerSync()

      if (run.status === 'failed') {
        notifyError('Sync failed', new Error(run.error ?? 'Unknown error'))
      } else {
        notifySuccess('Synced', `${countOf(run.counts?.findingsSeen ?? 0, 'finding')} seen`)
      }
    } catch (error) {
      notifyError('Sync failed', error)
    } finally {
      triggering.value = false
    }

    await refresh()
  }

  /**
   * Schedules the next poll of a polling session, faster while a sync runs on the server; a
   * session stopped or replaced meanwhile schedules nothing.
   * @param {number} session - Polling session the poll belongs to
   * @returns {void}
   */
  const schedule = (session: number): void => {
    if (session !== polling) {
      return
    }

    timer = setTimeout(
      async () => {
        await refresh()
        schedule(session)
      },
      status.value?.running ? SYNC_RUNNING_POLL_MS : SYNC_POLL_MS,
    )
  }

  /**
   * Stops polling, also a session still waiting for its first fetch.
   * @returns {void}
   */
  const stopPolling = (): void => {
    polling += 1

    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  /**
   * Fetches the status now and keeps polling it until stopped.
   * @returns {Promise<void>} - Resolves after the first fetch
   */
  const startPolling = async (): Promise<void> => {
    stopPolling()

    const session = polling

    await refresh()
    schedule(session)
  }

  return {
    status,
    triggering,
    lastFinished,
    running,
    lastSyncAt,
    ok,
    lastError,
    kevFeed,
    fetchError,
    refresh,
    sync,
    startPolling,
    stopPolling,
  }
})
