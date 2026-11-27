import type { CheckUsage } from '#core/check.ts'
import { cleanModels } from '#core/checkUsageValidation.ts'
import { isPlainObject } from '#core/isPlainObject.ts'

/**
 * Reads a token count.
 * @param {unknown} value - Raw value
 * @returns {number} - Non-negative integer, 0 when missing or invalid
 */
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0

/**
 * Reads the models of modelUsage, the one with the most output tokens first.
 * @param {unknown} value - Raw modelUsage, an object keyed by model id
 * @returns {string[]} - Model ids, empty when the value has an unexpected shape
 */
const readModels = (value: unknown): string[] => {
  if (!isPlainObject(value)) {
    return []
  }

  const ranked = Object.entries(value)
    .slice(0, 50)
    .map(([id, entry], index) => ({
      id,
      index,
      output: isPlainObject(entry) ? count(entry.outputTokens) : 0,
    }))
    .sort((a, b) => b.output - a.output || a.index - b.index)

  return cleanModels(ranked.map((model) => model.id)) ?? []
}

/**
 * Reads the usage of a result message.
 * @param {Record<string, unknown>} result - Parsed result message
 * @returns {CheckUsage | null} - Usage, null when the message carries none
 */
export const readUsage = (result: Record<string, unknown>): CheckUsage | null => {
  const usage = isPlainObject(result.usage) ? result.usage : null
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
    models: readModels(result.modelUsage),
  }
}
