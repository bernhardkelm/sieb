import type { CheckCreateResponse, CheckedImage, CheckSkipReason, CheckUsage } from '#core/check.ts'
import { countOf, formatCount } from '@/format/count'

export const CHECK_SKIP_LABELS: Record<CheckSkipReason, string> = {
  not_found: 'not found',
  resolved: 'resolved',
  not_public: 'not on a public image',
  already_open: 'already queued or running',
  queue_full: 'over the queue limit',
}

export interface CheckCreateNotice {
  title: string
  description: string | undefined
  /** Whether nothing was queued */
  none: boolean
}

/**
 * Summarises the skipped findings of a create answer per reason.
 * @param {CheckCreateResponse['skipped']} skipped - Skipped findings
 * @returns {string} - Text such as "Skipped 2: 1 not on a public image, 1 resolved.", empty for none
 */
export const skippedSummary = (skipped: CheckCreateResponse['skipped']): string => {
  if (skipped.length === 0) {
    return ''
  }

  const counts = new Map<CheckSkipReason, number>()

  for (const entry of skipped) {
    counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1)
  }

  const parts = [...counts].map(([reason, count]) => `${count} ${CHECK_SKIP_LABELS[reason]}`)

  return `Skipped ${skipped.length}: ${parts.join(', ')}.`
}

/**
 * Builds the toast after queueing checks.
 * @param {CheckCreateResponse} answer - Create answer
 * @returns {CheckCreateNotice} - Title, skipped reasons as description, whether nothing was queued
 */
export const checkCreateNotice = (answer: CheckCreateResponse): CheckCreateNotice => {
  const skipped = skippedSummary(answer.skipped)
  const first = answer.queued[0]

  if (first === undefined) {
    return { title: 'No check queued', description: skipped || undefined, none: true }
  }

  const title =
    answer.queued.length === 1 && first.position !== null
      ? `Auto-check queued at #${first.position}`
      : `${countOf(answer.queued.length, 'Auto-check')} queued`

  return { title, description: skipped || undefined, none: false }
}

/**
 * Builds the title of a create that failed after earlier requests queued checks.
 * @param {number} queued - Checks queued before the failure
 * @param {number} failed - Findings of the failed request and of those not sent
 * @returns {string} - Title such as "100 Auto-checks queued, 50 not queued"
 */
export const partialCreateTitle = (queued: number, failed: number): string =>
  `${countOf(queued, 'Auto-check')} queued, ${formatCount(failed)} not queued`

/**
 * Describes the tokens of a check.
 * @param {CheckUsage} usage - Usage
 * @returns {string} - Text such as "12.3K in · 1,104 out · 40K cache"
 */
export const usageText = (usage: CheckUsage): string =>
  [
    `${formatCount(usage.inputTokens)} in`,
    `${formatCount(usage.outputTokens)} out`,
    `${formatCount(usage.cacheReadTokens + usage.cacheCreationTokens)} cache`,
  ].join(' · ')

/**
 * Formats the API-equivalent cost estimate of a check.
 * @param {number | null} costUsd - Estimate in USD, null when unknown
 * @returns {string | null} - Text such as "$0.42", null when unknown
 */
export const costText = (costUsd: number | null): string | null =>
  costUsd === null ? null : `$${costUsd < 0.01 ? costUsd.toFixed(4) : costUsd.toFixed(2)}`

/**
 * Names the images a check exported by tag and short digest.
 * @param {readonly CheckedImage[] | undefined} images - Exported images, primary first
 * @returns {string | null} - Text such as "18-alpine (sha256:0123456789ab), 17 (sha256:…)", null for none
 */
export const checkedImagesText = (images: readonly CheckedImage[] | undefined): string | null => {
  if (images === undefined || images.length === 0) {
    return null
  }

  return images
    .map(({ digest, tag }) => {
      const short = digest.slice(0, digest.indexOf(':') + 13)

      return tag === null ? short : `${tag} (${short})`
    })
    .join(', ')
}
