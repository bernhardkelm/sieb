import type { CheckPhase } from '#core/check.ts'
import { HEARTBEAT_INTERVAL_MS } from '#core/checkLimits.ts'
import type { WorkerApi } from '#checker/api/workerApi.ts'
import { errorMessage } from '#checker/safeText.ts'

/** A running heartbeat */
export interface Heartbeat {
  setPhase: (phase: CheckPhase) => void
  stop: () => void
}

/** What the heartbeat needs */
export interface HeartbeatOptions {
  api: WorkerApi
  checkId: number
  phase: CheckPhase
  onAbort: () => void // sieb answered 409 or 404, the check was cancelled, timed out or is gone
  log: (line: string) => void
  intervalMs?: number
}

/**
 * Sends a heartbeat with the current phase right away, on every phase change and then every
 * HEARTBEAT_INTERVAL_MS. An abort answer calls onAbort once; failed requests are logged and
 * retried with the next beat.
 * @param {HeartbeatOptions} options - API, check, first phase, abort callback and log
 * @returns {Heartbeat} - Phase setter and stop function
 */
export const startHeartbeat = (options: HeartbeatOptions): Heartbeat => {
  let phase = options.phase
  let stopped = false
  let aborted = false

  /**
   * Sends one heartbeat and handles its answer.
   * @returns {Promise<void>}
   */
  const beat = async (): Promise<void> => {
    try {
      const answer = await options.api.heartbeat(options.checkId, { phase })

      if (answer === 'abort' && !stopped && !aborted) {
        aborted = true
        options.onAbort()
      }
    } catch (error) {
      options.log(
        `[sieb-checker] heartbeat of check ${options.checkId} failed: ${errorMessage(error)}`,
      )
    }
  }

  const timer = setInterval(() => void beat(), options.intervalMs ?? HEARTBEAT_INTERVAL_MS)

  void beat()

  return {
    setPhase: (next) => {
      if (next !== phase && !stopped) {
        phase = next
        void beat()
      }
    },
    stop: () => {
      stopped = true
      clearInterval(timer)
    },
  }
}
