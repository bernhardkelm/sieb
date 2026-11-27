import { defineStore } from 'pinia'

import { isUnseenNew } from '#core/findingRecency.ts'
import { MAX_SEEN_FINDINGS } from '#core/findingSeen.ts'
import { markFindingsSeen } from '@/api/findingsApi'
import { useFindingDetailStore } from '@/stores/findingDetailStore'
import { useFindingsStore } from '@/stores/findingsStore'

/** Quiet time after the last mark before the marks go to the server */
export const SEEN_FLUSH_MS = 1000

/**
 * Marks findings seen for the acting user: the findings store drops their "new" tag at once,
 * the ids go to POST /api/findings/seen in batches once marking pauses for SEEN_FLUSH_MS. A
 * failed request keeps its ids for the next flush without a toast, the tag stays dropped.
 * Findings the store knows as seen or not recent are not sent again.
 */
export const useFindingSeenStore = defineStore('findingSeen', () => {
  const findings = useFindingsStore()
  const detail = useFindingDetailStore()
  const marked = new Set<number>()
  const pending = new Set<number>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let flushing: Promise<void> | null = null

  /**
   * Sends the pending ids in requests of at most MAX_SEEN_FINDINGS, the first failure puts the
   * unsent ids back.
   * @returns {Promise<void>} - Resolves once sent or given up
   */
  const send = async (): Promise<void> => {
    const ids = [...pending]

    pending.clear()

    for (let start = 0; start < ids.length; start += MAX_SEEN_FINDINGS) {
      try {
        await markFindingsSeen(ids.slice(start, start + MAX_SEEN_FINDINGS))
      } catch {
        for (const id of ids.slice(start)) {
          pending.add(id)
        }

        return
      }
    }
  }

  /**
   * Sends the pending ids now, after a flush still in flight.
   * @returns {Promise<void>} - Resolves once sent or given up
   */
  const flush = async (): Promise<void> => {
    clearTimeout(timer)
    timer = undefined
    await flushing

    if (pending.size === 0) {
      return
    }

    flushing = send()
    await flushing
    flushing = null
  }

  /**
   * Returns whether a mark of a finding would change something: not marked in this session and
   * new for the user, or not loaded so the server decides.
   * @param {number} id - Finding id
   * @returns {boolean} - True when the id should be sent
   */
  const needsMark = (id: number): boolean => {
    if (marked.has(id)) {
      return false
    }

    const finding = findings.byId.get(id)

    return finding === undefined || isUnseenNew(finding, new Date())
  }

  /**
   * Marks findings seen and restarts the flush delay, also for ids of a failed request.
   * @param {readonly number[]} ids - Finding ids
   * @returns {void}
   */
  const markSeen = (ids: readonly number[]): void => {
    const fresh = ids.filter(needsMark)

    for (const id of fresh) {
      marked.add(id)
      pending.add(id)
    }

    findings.applySeen(fresh)

    if (pending.size > 0) {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void flush()
      }, SEEN_FLUSH_MS)
    }
  }

  /**
   * Marks the finding shown in the side panel seen, for an action the user takes on it.
   * @returns {void}
   */
  const markShown = (): void => {
    const id = detail.detail?.finding.id

    if (id !== undefined) {
      markSeen([id])
    }
  }

  return { markSeen, markShown, flush }
})
