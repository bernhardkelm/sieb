/** Marks an element whose own area is empty list space, a click there clears the checked rows */
export const LIST_BACKGROUND = 'data-list-background'

/** Marks the list area while rows are checked */
export const LIST_CHECKED = 'data-list-checked'

/**
 * Returns whether a press lands on empty space of a list with checked rows, not on a row, a
 * control or anything else inside it. Such a press clears the checked rows and keeps the panel.
 * @param {EventTarget | null} target - Event target
 * @returns {boolean} - True for empty space of a list with checked rows
 */
export const isClearingTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.hasAttribute(LIST_BACKGROUND) &&
  target.closest(`[${LIST_CHECKED}]`) !== null
