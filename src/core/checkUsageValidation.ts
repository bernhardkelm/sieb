import type { ValidationIssue } from '#core/apiTypes.ts'
import type { CheckUsage } from '#core/check.ts'

const COUNT_FIELDS = [
  'inputTokens',
  'outputTokens',
  'cacheReadTokens',
  'cacheCreationTokens',
  'turns',
] as const

/**
 * Returns whether a value is a non-negative safe integer.
 * @param {unknown} value - Raw value
 * @returns {boolean} - True for counts such as token numbers
 */
const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0

/**
 * Reads the Claude usage of a worker result: null, or an object with non-negative integer counts
 * and a non-negative finite cost or null. Unknown keys are dropped.
 * @param {unknown} value - Raw usage
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {CheckUsage | null} - Usage, null when absent or invalid
 */
export const readCheckUsage = (value: unknown, errors: ValidationIssue[]): CheckUsage | null => {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    errors.push({ field: 'usage', code: 'invalid' })
    return null
  }

  const raw = value as Record<string, unknown>
  const invalid = COUNT_FIELDS.find((field) => !isCount(raw[field]))
  const cost = raw.costUsd ?? null

  if (invalid !== undefined) {
    errors.push({ field: `usage.${invalid}`, code: 'invalid' })
    return null
  }

  if (cost !== null && (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0)) {
    errors.push({ field: 'usage.costUsd', code: 'invalid' })
    return null
  }

  return {
    inputTokens: raw.inputTokens as number,
    outputTokens: raw.outputTokens as number,
    cacheReadTokens: raw.cacheReadTokens as number,
    cacheCreationTokens: raw.cacheCreationTokens as number,
    costUsd: cost,
    turns: raw.turns as number,
  }
}
