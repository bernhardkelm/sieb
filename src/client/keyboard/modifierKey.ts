/**
 * Returns whether the browser runs on an Apple platform, where Cmd replaces Ctrl.
 * @returns {boolean} - True on macOS and iOS
 */
const isApplePlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

export const MODIFIER_KEY = isApplePlatform() ? '⌘' : 'Ctrl'
