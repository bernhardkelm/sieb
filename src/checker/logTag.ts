/** Names of the two worker processes, the prefix of their log lines */
export type LogProcess = 'sieb-checker' | 'sieb-fetcher'

let current: LogProcess = 'sieb-checker'

/**
 * Sets the process name the log lines of shared code carry, once at the start of a process.
 * @param {LogProcess} name - Process name
 * @returns {void}
 */
export const setLogProcess = (name: LogProcess): void => {
  current = name
}

/**
 * Returns the prefix of a log line of this process.
 * @returns {string} - For example [sieb-fetcher]
 */
export const logTag = (): string => `[${current}]`
