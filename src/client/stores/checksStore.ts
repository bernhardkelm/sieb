import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import type { ChecksResponse } from '#core/check.ts'
import { ApiError } from '@/api/ApiError'
import { errorMessage } from '@/api/apiRequest'
import { cancelCheck, createChecks, fetchChecks } from '@/api/checksApi'
import {
  checksPollInterval,
  latestChecksByFinding,
  openChecksOf,
} from '@/components/checks/checkLookup'
import { createInBatches, type CheckBatchResult } from '@/stores/checkBatches'
import { createCheckLookups } from '@/stores/checkLookups'
import { createChecksPolling } from '@/stores/checksPolling'
import { useInboxStore } from '@/stores/inboxStore'
import { useMcpStore } from '@/stores/mcpStore'

/**
 * Holds the Auto-checks: whether the feature is on and the worker online, the running check, the
 * queue and the recent checks, with the latest check per finding for the chips. Polls every 5
 * seconds while a check is open or the Checks page shows, every 60 seconds otherwise, and stops
 * once the server answers that the feature is off or has no checks route. Until the first
 * answer the MCP info decides whether the feature counts as on. A check that leaves the queue
 * refetches the Inbox, so its proposal shows up there at once.
 */
export const useChecksStore = defineStore('checks', () => {
  const mcp = useMcpStore()
  const inbox = useInboxStore()

  const response = shallowRef<ChecksResponse | null>(null)
  const missing = ref(false)
  const error = ref<string | null>(null)
  let request = 0

  const mcpChecksEnabled = computed(() => mcp.info?.checksEnabled)
  const loaded = computed(() => response.value !== null || missing.value)
  const enabled = computed(() =>
    missing.value ? false : (response.value?.enabled ?? mcpChecksEnabled.value === true),
  )
  const workerOnline = computed(() => response.value?.workerOnline === true)
  const open = computed(() => openChecksOf(response.value))
  const latest = computed(() => latestChecksByFinding(response.value))
  const running = computed(() => response.value?.running ?? null)
  const queued = computed(() => response.value?.queued ?? [])
  const recent = computed(() => response.value?.recent ?? [])
  const usage = computed(() => response.value?.usage ?? null)
  const { latestFor, openFor, rowCheckFor } = createCheckLookups(latest)

  const polling = createChecksPolling(
    () => refresh(),
    (pageShown) => checksPollInterval(response.value, pageShown),
    () => mcpChecksEnabled.value !== false && !missing.value && response.value?.enabled !== false,
  )

  /**
   * Stores an answer, refetches the Inbox when an open check finished, stops polling when off.
   * @param {ChecksResponse} next - Checks answer
   * @returns {void}
   */
  const apply = (next: ChecksResponse): void => {
    const stillOpen = new Set(openChecksOf(next).map((check) => check.id))
    const finished = open.value.some((check) => !stillOpen.has(check.id))

    response.value = next
    error.value = null

    if (finished) {
      void inbox.refresh()
    }

    if (!next.enabled) {
      polling.stop()
    }
  }

  /**
   * Fetches the checks; the newest request wins, a failed refetch keeps the last answer and a
   * 404 marks the feature as missing on this server.
   * @returns {Promise<void>} - Resolves when stored or the error recorded
   */
  const refresh = async (): Promise<void> => {
    const current = ++request

    try {
      const next = await fetchChecks()

      if (current === request) {
        apply(next)
      }
    } catch (failure) {
      if (current === request) {
        missing.value = failure instanceof ApiError && failure.status === 404
        error.value = errorMessage(failure)

        if (missing.value) {
          polling.stop()
        }
      }
    }
  }

  /**
   * Queues checks for findings in requests of at most MAX_CHECK_FINDINGS, then refetches once,
   * so the queue and chips update.
   * @param {readonly number[]} findingIds - Finding ids
   * @param {boolean} force - Queues findings an open proposal already covers
   * @returns {Promise<CheckBatchResult>} - Queued and skipped findings, the failed request if any
   */
  const create = async (
    findingIds: readonly number[],
    force = false,
  ): Promise<CheckBatchResult> => {
    const result = await createInBatches(
      (ids) => (force ? createChecks(ids, true) : createChecks(ids)),
      findingIds,
    )

    polling.runNow()
    return result
  }

  /**
   * Cancels a queued or running check and refetches at once.
   * @param {number} id - Check id
   * @returns {Promise<void>} - Resolves once cancelled
   */
  const cancel = async (id: number): Promise<void> => {
    await cancelCheck(id)
    polling.runNow()
  }

  watch(mcpChecksEnabled, (value) => {
    if (value === false && response.value === null) {
      polling.stop()
    }
  })

  return {
    response,
    loaded,
    error,
    enabled,
    workerOnline,
    open,
    running,
    queued,
    recent,
    usage,
    latestFor,
    openFor,
    rowCheckFor,
    refresh,
    create,
    cancel,
    startPolling: polling.start,
    stopPolling: polling.stop,
    showPage: polling.showPage,
  }
})
