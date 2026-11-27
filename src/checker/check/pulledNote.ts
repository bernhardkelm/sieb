import type { WorkerResult } from '#core/check.ts'
import {
  capText,
  MAX_CHECK_ERROR_LENGTH,
  MAX_CHECK_REPLY_LENGTH,
  textLength,
} from '#core/checkLimits.ts'
import type { PulledImage } from '#checker/workspace/resolveImage.ts'

type ResultParts = Omit<WorkerResult, 'durationMs'>

const NOTE_MAX_LENGTH = 300

/**
 * Describes the pulled image for the Checks page.
 * @param {PulledImage} image - Pulled image
 * @returns {string} - Note of at most 300 code points
 */
export const pulledNote = (image: PulledImage): string =>
  capText(
    image.scanned
      ? `Pulled ${image.ref}, the scanned digest.`
      : `Pulled ${image.ref}, resolved from the tag at check time; the scanned digest is unknown.`,
    NOTE_MAX_LENGTH,
  )

/**
 * Adds the pulled digest to the result: the note goes into the error of a failed check and
 * after the reply of a finished one, cutting the text before it so the note always fits.
 * @param {ResultParts} parts - Result parts of the check
 * @param {PulledImage} image - Pulled image
 * @returns {ResultParts} - Parts with the note and pulledDigest
 */
export const withPulledImage = (parts: ResultParts, image: PulledImage): ResultParts => {
  const note = pulledNote(image)

  if (parts.status === 'failed') {
    const error = capText(parts.error ?? 'failed', MAX_CHECK_ERROR_LENGTH - textLength(note) - 3)

    return { ...parts, error: `${error} (${note})`, pulledDigest: image.digest }
  }

  const reply =
    parts.reply === null
      ? note
      : `${capText(parts.reply, MAX_CHECK_REPLY_LENGTH - textLength(note) - 2)}\n\n${note}`

  return { ...parts, reply, pulledDigest: image.digest }
}
