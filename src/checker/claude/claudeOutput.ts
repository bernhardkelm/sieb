import type { CheckUsage, WorkerResult } from '#core/check.ts'
import { capText, MAX_CHECK_ERROR_LENGTH, MAX_CHECK_REPLY_LENGTH } from '#core/checkLimits.ts'
import { errorTail } from '#checker/process/errorTail.ts'
import type { CapturedRun } from '#checker/process/runCaptured.ts'

/** What the json output of claude -p reports */
export interface ClaudeOutput {
  usage: CheckUsage | null
  reply: string | null
  isError: boolean
  subtype: string | null
}

type ResultParts = Omit<WorkerResult, 'durationMs'>

const SUBTYPE_ERRORS: Record<string, string> = {
  error_max_turns: 'Claude reached the turn limit',
  error_max_budget_usd: 'Claude reached the budget limit',
  error_during_execution: 'Claude failed during execution',
}

/**
 * Returns whether a value is a plain object.
 * @param {unknown} value - Value
 * @returns {boolean} - Whether it is a non-null, non-array object
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Reads a token count.
 * @param {unknown} value - Raw value
 * @returns {number} - Non-negative integer, 0 when missing or invalid
 */
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0

/**
 * Reads the usage of a result message.
 * @param {Record<string, unknown>} result - Parsed result message
 * @returns {CheckUsage | null} - Usage, null when the message carries none
 */
const readUsage = (result: Record<string, unknown>): CheckUsage | null => {
  const usage = isRecord(result.usage) ? result.usage : null
  const cost = result.total_cost_usd

  if (!usage && typeof cost !== 'number' && typeof result.num_turns !== 'number') {
    return null
  }

  return {
    inputTokens: count(usage?.input_tokens),
    outputTokens: count(usage?.output_tokens),
    cacheReadTokens: count(usage?.cache_read_input_tokens),
    cacheCreationTokens: count(usage?.cache_creation_input_tokens),
    costUsd: typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null,
    turns: count(result.num_turns),
  }
}

/**
 * Parses the stdout of claude -p --output-format json.
 * @param {string} stdout - Captured stdout
 * @returns {ClaudeOutput | null} - Usage, final reply and error flags, null when it is no result object
 */
export const parseClaudeOutput = (stdout: string): ClaudeOutput | null => {
  let parsed: unknown

  try {
    parsed = JSON.parse(stdout.trim())
  } catch {
    return null
  }

  if (!isRecord(parsed)) {
    return null
  }

  const text = typeof parsed.result === 'string' ? parsed.result.trim() : ''

  return {
    usage: readUsage(parsed),
    reply: text ? capText(text, MAX_CHECK_REPLY_LENGTH) : null,
    isError: parsed.is_error === true,
    subtype: typeof parsed.subtype === 'string' ? parsed.subtype : null,
  }
}

/**
 * Returns the error text of a failed Claude run, null when the run succeeded.
 * @param {CapturedRun} run - Captured claude run
 * @param {ClaudeOutput | null} output - Parsed output
 * @param {number} timeoutSeconds - Wall-clock limit for the message
 * @returns {string | null} - Short error text
 */
const claudeError = (
  run: CapturedRun,
  output: ClaudeOutput | null,
  timeoutSeconds: number,
): string | null => {
  if (run.timedOut) {
    return `Claude timed out after ${timeoutSeconds} s`
  }

  if (run.exit.error) {
    return `Claude could not start: ${run.exit.error}`
  }

  if (output?.isError || output?.subtype?.startsWith('error')) {
    const known = output.subtype ? SUBTYPE_ERRORS[output.subtype] : undefined

    return known ?? `Claude reported an error: ${errorTail(output.reply ?? output.subtype ?? '')}`
  }

  if (run.exit.code !== 0) {
    return `Claude exited with ${run.exit.code ?? run.exit.signal}: ${errorTail(run.stderr)}`
  }

  if (run.stdoutTruncated) {
    return 'Claude wrote more output than the worker reads'
  }

  return output ? null : 'Claude returned no JSON result'
}

/**
 * Maps a finished Claude run to the result parts sieb receives.
 * @param {CapturedRun} run - Captured claude run
 * @param {number} timeoutSeconds - Wall-clock limit the run had
 * @returns {ResultParts} - Status, error, usage and reply
 */
export const claudeResult = (run: CapturedRun, timeoutSeconds: number): ResultParts => {
  const output = parseClaudeOutput(run.stdout)
  const error = claudeError(run, output, timeoutSeconds)

  return {
    status: error ? 'failed' : 'done',
    error: error ? capText(error, MAX_CHECK_ERROR_LENGTH) : null,
    usage: output?.usage ?? null,
    reply: output?.reply ?? null,
  }
}
