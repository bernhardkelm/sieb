/**
 * Returns whether a keyboard event targets a text entry, where single-key shortcuts must not fire.
 * @param {EventTarget | null} target - Event target
 * @returns {boolean} - True for inputs, textareas, selects and contenteditable elements
 */
export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Returns whether a keydown event may trigger a single-key shortcut: not yet handled, no
 * modifier besides Shift, so browser chords such as Cmd+R stay with the browser, not typed into
 * a text entry and not a key repeat unless the shortcut repeats.
 * @param {KeyboardEvent} event - Keydown event
 * @param {boolean} allowRepeat - Whether a held key may repeat the shortcut
 * @returns {boolean} - True when the shortcut may run
 */
export const isShortcutEvent = (event: KeyboardEvent, allowRepeat: boolean = false): boolean =>
  !event.defaultPrevented &&
  (allowRepeat || !event.repeat) &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !isEditableTarget(event.target)

export const SHORTCUT_SCOPE_ATTRIBUTE = 'data-shortcut-scope'

/**
 * Returns where a key press happened: inside an element marked as overlay (popovers, dialogs) or
 * panel, or on the page.
 * @param {EventTarget | null} target - Event target
 * @returns {'page' | 'panel' | 'overlay'} - Scope of the nearest marked ancestor, page without one
 */
export const shortcutScope = (target: EventTarget | null): 'page' | 'panel' | 'overlay' => {
  if (!(target instanceof Element)) {
    return 'page'
  }

  if (target.closest('[role="dialog"], [role="alertdialog"]')) {
    return 'overlay'
  }

  const scope = target
    .closest(`[${SHORTCUT_SCOPE_ATTRIBUTE}]`)
    ?.getAttribute(SHORTCUT_SCOPE_ATTRIBUTE)

  return scope === 'panel' || scope === 'overlay' ? scope : 'page'
}

/**
 * Returns whether a key press targets a control other than a list row, such as a button, link
 * or tab, where Enter and Space belong to the control.
 * @param {EventTarget | null} target - Event target
 * @returns {boolean} - True inside buttons, links and tabs
 */
export const isControlTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('button, a[href], [role="tab"]') !== null

/**
 * Returns whether a key press targets a list or nothing in particular, where list chords such as
 * select all apply instead of their browser default.
 * @param {EventTarget | null} target - Event target
 * @returns {boolean} - True for the page body, the main landmark and elements inside a list
 */
export const isListTarget = (target: EventTarget | null): boolean =>
  target === document.body ||
  (target instanceof Element &&
    (target.tagName === 'MAIN' || target.closest('[role="listbox"], [role="treegrid"]') !== null))
