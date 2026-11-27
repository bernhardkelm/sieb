import type { ChildProcess } from 'node:child_process'

/**
 * Waits for a number of milliseconds.
 * @param {number} ms - Delay
 * @returns {Promise<void>} - Resolves after the delay
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * Polls until a probe returns a value other than null or the time runs out.
 * @param {() => Promise<T | null>} probe - Returns the awaited value, null to keep waiting
 * @param {number} timeoutMs - Longest wait
 * @param {string} what - What is awaited, for the error
 * @returns {Promise<T>} - First value the probe returned
 * @throws {Error} - When the time runs out
 */
export const pollFor = async <T>(
  probe: () => Promise<T | null>,
  timeoutMs: number,
  what: string,
): Promise<T> => {
  const until = Date.now() + timeoutMs

  while (Date.now() < until) {
    const value = await probe().catch(() => null)

    if (value !== null) {
      return value
    }

    await sleep(150)
  }

  throw new Error(`timed out waiting for ${what}`)
}

/**
 * Resolves once a child process has exited.
 * @param {ChildProcess} child - Child process
 * @returns {Promise<void>} - Resolves on exit, at once when it already exited
 */
export const exited = (child: ChildProcess): Promise<void> =>
  child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve()
    : new Promise((resolve) => {
        child.once('exit', () => resolve())
      })

/**
 * Stops a child process with SIGTERM and falls back to SIGKILL after a grace period.
 * @param {ChildProcess} child - Child process
 * @param {number} graceMs - Time SIGTERM gets
 * @returns {Promise<void>} - Resolves once the process has exited
 */
export const stopProcess = async (child: ChildProcess, graceMs = 5000): Promise<void> => {
  const done = exited(child)

  child.kill('SIGTERM')

  const timer = setTimeout(() => {
    child.kill('SIGKILL')
  }, graceMs)

  await done
  clearTimeout(timer)
}
