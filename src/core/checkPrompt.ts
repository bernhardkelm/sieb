import type { CheckPull } from '#core/checkPull.ts'
import { buildHandoffPrompts, type HandoffInput } from '#core/handoffPrompt.ts'

const TAG_PATTERN = /^\w[\w.-]{0,127}$/
const DIGEST_PATTERN = /^[a-z0-9]+(?:[+._-][a-z0-9]+)*:[0-9a-f]{32,}$/

/** Longest digest sieb stores, the column limit of checks.pulled_digest */
export const MAX_DIGEST_LENGTH = 200

/**
 * Returns whether a value is an image digest such as sha256:<hex>.
 * @param {string} value - Value
 * @returns {boolean} - True for a digest of at most MAX_DIGEST_LENGTH characters
 */
export const isImageDigest = (value: string): boolean =>
  value.length <= MAX_DIGEST_LENGTH && DIGEST_PATTERN.test(value)

/**
 * Returns whether a value is an image tag, which is also safe as a directory name.
 * @param {string} value - Value
 * @returns {boolean} - True for word characters, dots and dashes, not leading, at most 128
 */
export const isImageTag = (value: string): boolean => TAG_PATTERN.test(value)

const LISTED_NOT_PULLED = 10

/**
 * Describes the open tags the worker does not pull, beyond the image cap.
 * @param {readonly string[]} notPulled - Labels of the uncovered tags
 * @returns {string} - Prompt sentence with a leading space, empty when every tag is pulled
 */
const notPulledText = (notPulled: readonly string[]): string => {
  if (notPulled.length === 0) {
    return ''
  }

  const listed = notPulled.slice(0, LISTED_NOT_PULLED).join(', ')
  const rest = notPulled.length - LISTED_NOT_PULLED
  const more = rest > 0 ? ` and ${rest} more` : ''
  const subject = notPulled.length === 1 ? '1 more tag was' : `${notPulled.length} more tags were`

  const pronoun = notPulled.length === 1 ? 'it' : 'them'

  return ` ${subject} not pulled: ${listed}${more}. Name ${pronoun} under unknowns.`
}

/** Error of a check whose image sieb cannot pin, it fails at claim */
export const NO_PULL_REF_ERROR =
  'sieb knows neither a digest nor a tag of the scanned image, so the worker cannot pull it.'

/**
 * Builds the investigation prompt of a check: the chat hand-off prompt, which suits public
 * images, plus a note that nobody answers questions, for a pull by tag that the tag may have
 * moved since the scan, and the open tags beyond the image cap. The worker appends the
 * workspace layout.
 * @param {HandoffInput} input - Finding and its instances
 * @param {CheckPull} pull - What the worker pulls
 * @returns {string} - Prompt
 */
export const buildCheckPrompt = (input: HandoffInput, pull: CheckPull): string => {
  const unattended =
    ' You run unattended as a sieb Auto-check, nobody can answer questions: decide from the' +
    ' evidence and say what stayed unknown.'
  const tagOnly =
    pull.imageDigest === null
      ? ` sieb knows no digest of the scanned image, so ${pull.imageRef} may differ from what` +
        ' Trivy scanned: compare the package versions before you rely on them.'
      : ''

  return `${buildHandoffPrompts(input).chat}${unattended}${tagOnly}${notPulledText(pull.notPulled)}`
}
