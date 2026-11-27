import type { ImageAccess, ImageVisibility } from '#core/imageVisibility.ts'

/** One chip of the image access facts */
export interface ImageAccessChip {
  kind: 'ownership' | 'visibility'
  value: string // ownership or visibility value, for data attributes
  label: string
  hint: string
}

export const OWN_IMAGE_CHIP: Omit<ImageAccessChip, 'kind' | 'value'> = {
  label: 'Own image',
  hint: 'Own image: its repository may be on this machine for Claude Code, or checked out into source/ by Auto-check.',
}

export const VISIBILITY_CHIPS: Partial<
  Record<ImageVisibility, Pick<ImageAccessChip, 'label' | 'hint'>>
> = {
  public: {
    label: 'Public image',
    hint: 'Anyone can pull this image without a login, so Claude and Auto-check can inspect it.',
  },
  credential: {
    label: 'Private · credential',
    hint: 'Private image: a registry credential stored in sieb covers it, Auto-check pulls it with that credential.',
  },
  restricted: {
    label: 'Not pullable',
    hint: 'The image cannot be pulled without a login and no stored registry credential covers it.',
  },
}

/**
 * Lists the chips that add information about an image: Own image for own images unless an owner
 * chip already says so, then its visibility, where public shows only for own images since
 * third-party images are public by default and unknown never shows.
 * @param {ImageAccess} access - Visibility and ownership of the image
 * @param {boolean} ownerShown - Whether the owner label is shown next to the chips
 * @returns {ImageAccessChip[]} - Chips in display order, empty when nothing stands out
 */
export const imageAccessChips = (
  { imageVisibility, ownership }: ImageAccess,
  ownerShown = false,
): ImageAccessChip[] => {
  const own = ownership === 'own'
  const visibility =
    imageVisibility === 'public' && !own ? undefined : VISIBILITY_CHIPS[imageVisibility]

  return [
    ...(own && !ownerShown
      ? [{ kind: 'ownership' as const, value: ownership, ...OWN_IMAGE_CHIP }]
      : []),
    ...(visibility === undefined
      ? []
      : [{ kind: 'visibility' as const, value: imageVisibility, ...visibility }]),
  ]
}
