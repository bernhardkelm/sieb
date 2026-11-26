const DRAFT_KEYS = new Set([
  'j',
  'k',
  'J',
  'K',
  'ArrowDown',
  'ArrowUp',
  'Home',
  'End',
  'PageDown',
  'PageUp',
  'Escape',
])

/**
 * Returns whether a key moves the side panel to another finding or closes it, which would throw
 * away an unsaved draft of its decision form.
 * @param {string} key - KeyboardEvent key
 * @returns {boolean} - True for the cursor movement keys and Escape
 */
export const isDraftKey = (key: string): boolean => DRAFT_KEYS.has(key)
