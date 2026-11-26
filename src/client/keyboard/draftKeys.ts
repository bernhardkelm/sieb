const DRAFT_KEYS = new Set(['j', 'k', 'ArrowDown', 'ArrowUp', 'Escape'])

/**
 * Returns whether a key moves the side panel to another finding or closes it, which would throw
 * away an unsaved draft of its decision form.
 * @param {string} key - KeyboardEvent key
 * @returns {boolean} - True for j, k, the vertical arrows and Escape
 */
export const isDraftKey = (key: string): boolean => DRAFT_KEYS.has(key)
