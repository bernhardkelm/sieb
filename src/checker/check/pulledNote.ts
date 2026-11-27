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
 * Describes the pulled images for the Checks page: the primary one and how many more.
 * @param {PulledImage} image - Primary image
 * @param {number} extra - Further images in the workspace
 * @returns {string} - Note of at most 300 code points
 */
export const pulledNote = (image: PulledImage, extra = 0): string => {
  const more = extra === 0 ? '' : ` Plus ${extra} more ${extra === 1 ? 'image' : 'images'}.`

  return capText(
    image.scanned
      ? `Pulled ${image.ref}, the scanned digest.${more}`
      : `Pulled ${image.ref}, resolved from the tag at check time; the scanned digest is unknown.${more}`,
    NOTE_MAX_LENGTH,
  )
}

/**
 * Adds the pulled digests to the result: the note goes into the error of a failed check and
 * after the reply of a finished one, cutting the text before it so the note always fits.
 * @param {ResultParts} parts - Result parts of the check
 * @param {PulledImage[]} images - Images in the workspace, primary first, at least one
 * @returns {ResultParts} - Parts with the note, pulledDigest and pulledDigests
 */
export const withPulledImages = (parts: ResultParts, images: PulledImage[]): ResultParts => {
  const [primary] = images

  if (primary === undefined) {
    return parts
  }

  const note = pulledNote(primary, images.length - 1)
  const pulled = { pulledDigest: primary.digest, pulledDigests: images.map(({ digest }) => digest) }

  if (parts.status === 'failed') {
    const error = capText(parts.error ?? 'failed', MAX_CHECK_ERROR_LENGTH - textLength(note) - 3)

    return { ...parts, error: `${error} (${note})`, ...pulled }
  }

  const reply =
    parts.reply === null
      ? note
      : `${capText(parts.reply, MAX_CHECK_REPLY_LENGTH - textLength(note) - 2)}\n\n${note}`

  return { ...parts, reply, ...pulled }
}
