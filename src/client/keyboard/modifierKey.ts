/**
 * Returns whether the browser runs on an Apple platform, where Cmd replaces Ctrl.
 * @returns {boolean} - True on macOS and iOS
 */
const isApplePlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

const APPLE = isApplePlatform()

export const MODIFIER_KEY = APPLE ? '⌘' : 'Ctrl'

/**
 * Returns whether the platform command modifier is held: Cmd on Apple platforms, Ctrl elsewhere.
 * Ctrl on macOS opens the context menu, so it never counts there.
 * @param {Pick<MouseEvent, 'metaKey' | 'ctrlKey'>} event - Mouse or keyboard event
 * @param {boolean} apple - Whether the platform is an Apple one
 * @returns {boolean} - True while the command modifier is held
 */
export const hasCommandModifier = (
  event: Pick<MouseEvent, 'metaKey' | 'ctrlKey'>,
  apple: boolean = APPLE,
): boolean => (apple ? event.metaKey : event.ctrlKey)
