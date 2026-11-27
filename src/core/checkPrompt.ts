import { buildHandoffPrompts, type HandoffInput } from '#core/handoffPrompt.ts'
import type { FindingInstance } from '#core/instance.ts'

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

type PullInstance = Pick<
  FindingInstance,
  'id' | 'imageTag' | 'imageDigest' | 'lastSeen' | 'resolvedAt'
>

/** What the worker pulls: a digest-pinned ref, else a tagged ref without a known digest */
export interface CheckPull {
  imageRef: string // repository@digest or repository:tag
  imageDigest: string | null // null when only the tag is known
}

/**
 * Returns what the worker pulls: the finding's image with the digest of its most recently seen
 * open instance, else with that instance's tag. Never a bare ref, which would pull latest, a
 * different image than the one Trivy scanned. Values that are not a valid tag or digest are
 * skipped, so the ref never carries scanner text.
 * @param {string} imageRef - Image ref of the finding, without tag
 * @param {readonly PullInstance[]} instances - Instances of the finding
 * @returns {CheckPull | null} - Pull, null when sieb knows neither a digest nor a tag
 */
export const checkPullRef = (
  imageRef: string,
  instances: readonly PullInstance[],
): CheckPull | null => {
  const open = instances
    .filter((instance) => instance.resolvedAt === null)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || b.id - a.id)
  const digest = open.find((instance) => isImageDigest(instance.imageDigest ?? ''))?.imageDigest

  if (digest !== undefined && digest !== null) {
    return { imageRef: `${imageRef}@${digest}`, imageDigest: digest }
  }

  const tag = open.find((instance) => TAG_PATTERN.test(instance.imageTag ?? ''))?.imageTag

  return tag === undefined || tag === null
    ? null
    : { imageRef: `${imageRef}:${tag}`, imageDigest: null }
}

/** Error of a check whose image sieb cannot pin, it fails at claim */
export const NO_PULL_REF_ERROR =
  'sieb knows neither a digest nor a tag of the scanned image, so the worker cannot pull it.'

/**
 * Builds the investigation prompt of a check: the chat hand-off prompt, which suits public
 * images, plus a note that nobody answers questions and, for a pull by tag, that the tag may
 * have moved since the scan. The worker appends the workspace layout.
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

  return `${buildHandoffPrompts(input).chat}${unattended}${tagOnly}`
}
