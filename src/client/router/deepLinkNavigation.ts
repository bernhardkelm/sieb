/** Time after opening a deep link in which a beforeunload counts as caused by it, in ms */
export const DEEP_LINK_UNLOAD_WINDOW_MS = 1000

let deepLinkUntil = 0

/**
 * Opens a custom-scheme deep link such as claude://. The operating system takes the link and the
 * page stays, yet browsers still fire beforeunload for it, so unload prompts check
 * `isDeepLinkUnload` and stay quiet for it.
 * @param {string} link - Deep link
 * @returns {void}
 */
export const openDeepLink = (link: string): void => {
  deepLinkUntil = Date.now() + DEEP_LINK_UNLOAD_WINDOW_MS
  window.location.assign(link)
}

/**
 * Returns whether a beforeunload now belongs to a deep link opened just before, which does not
 * unload the page. The window is timed since some browsers fire the event after assign returns.
 * @returns {boolean} - True within DEEP_LINK_UNLOAD_WINDOW_MS after openDeepLink
 */
export const isDeepLinkUnload = (): boolean => Date.now() < deepLinkUntil
