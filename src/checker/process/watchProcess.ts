import type { RunningProcess } from '#checker/process/processRunner.ts'

/** Why a watched process was killed */
export interface ProcessWatch {
  timedOut: () => boolean
  aborted: () => boolean
  release: () => void
}

/**
 * Kills a process group when the signal aborts or the timeout passes.
 * @param {RunningProcess} child - Started process
 * @param {AbortSignal} signal - Abort signal of the check
 * @param {number} timeoutMs - Wall-clock limit
 * @returns {ProcessWatch} - Kill reasons and the cleanup call
 */
export const watchProcess = (
  child: RunningProcess,
  signal: AbortSignal,
  timeoutMs: number,
): ProcessWatch => {
  let timedOut = false
  let aborted = false

  /**
   * Marks the run as aborted and kills the process group.
   * @returns {void}
   */
  const onAbort = (): void => {
    aborted = true
    child.kill()
  }
  const timer = setTimeout(
    () => {
      timedOut = true
      child.kill()
    },
    Math.max(timeoutMs, 0),
  )

  if (signal.aborted) {
    onAbort()
  } else {
    signal.addEventListener('abort', onAbort, { once: true })
  }

  return {
    timedOut: () => timedOut,
    aborted: () => aborted,
    release: () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
    },
  }
}
