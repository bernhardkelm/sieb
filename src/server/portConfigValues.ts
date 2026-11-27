import { parseIntUpTo } from '#server/configValues.ts'

export const MAX_PORT = 65535

/**
 * Parses an optional listener port.
 * @param {string | undefined} value - Raw value
 * @param {string} name - Variable name for the error message
 * @returns {number | null} - Port, null when unset or blank
 * @throws {Error} - When the value is not an integer between 1 and MAX_PORT
 */
export const parseOptionalPort = (value: string | undefined, name: string): number | null => {
  const trimmed = value?.trim() ?? ''

  return trimmed === '' ? null : parseIntUpTo(trimmed, name, MAX_PORT)
}

/**
 * Parses the optional port of the separate /metrics listener.
 * @param {string | undefined} value - Raw SIEB_METRICS_PORT value
 * @param {number} mainPort - Port of the main listener, which it must differ from
 * @returns {number | null} - Port, null when unset or blank
 * @throws {Error} - For an invalid port or the main port
 */
export const parseMetricsPort = (value: string | undefined, mainPort: number): number | null => {
  const port = parseOptionalPort(value, 'SIEB_METRICS_PORT')

  if (port === mainPort) {
    throw new Error(`SIEB_METRICS_PORT must differ from SIEB_PORT, both are ${port}`)
  }

  return port
}

/**
 * Parses the port of the worker listener, which must differ from the main and metrics ports.
 * @param {string | undefined} value - Raw SIEB_WORKER_PORT value
 * @param {{ port: number; metricsPort: number | null }} ports - Main and metrics port
 * @returns {number} - Port
 * @throws {Error} - When unset, invalid or taken by another listener
 */
export const parseWorkerPort = (
  value: string | undefined,
  { port, metricsPort }: { port: number; metricsPort: number | null },
): number => {
  const workerPort = parseOptionalPort(value, 'SIEB_WORKER_PORT')

  if (workerPort === null) {
    throw new Error('SIEB_WORKER_PORT must be set when SIEB_CHECKS_ENABLED=true')
  }

  if (workerPort === port || workerPort === metricsPort) {
    throw new Error(
      `SIEB_WORKER_PORT must differ from SIEB_PORT and SIEB_METRICS_PORT, got ${workerPort}`,
    )
  }

  return workerPort
}
