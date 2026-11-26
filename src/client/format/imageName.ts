/**
 * Returns the last path segment of an image reference, the name a person recognises.
 * @param {string} imageRef - Registry and repository without tag
 * @returns {string} - Last segment, the whole reference when it has no slash
 */
export const shortImageName = (imageRef: string): string =>
  imageRef.slice(imageRef.lastIndexOf('/') + 1) || imageRef

/**
 * Returns the key that sorts images by the name a person sees, the full reference breaking ties.
 * @param {string} imageRef - Registry and repository without tag
 * @returns {string} - Short name followed by the full reference
 */
export const imageSortName = (imageRef: string): string => `${shortImageName(imageRef)} ${imageRef}`
