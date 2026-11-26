export type AuthMode = 'header' | 'oidc'

let authMode: AuthMode | null = null
let redirected = false
let writeExpiredHandler: (() => void) | null = null

/**
 * Remembers the auth mode the server reported.
 * @param {AuthMode | null} mode - Reported mode, null while unknown
 * @returns {void}
 */
export const setAuthMode = (mode: AuthMode | null): void => {
  authMode = mode
}

/**
 * Registers the callback that tells the user a write failed because the session expired.
 * @param {(() => void) | null} handler - Callback, null removes it
 * @returns {void}
 */
export const onWriteSessionExpired = (handler: (() => void) | null): void => {
  writeExpiredHandler = handler
}

/**
 * Encodes the current path and query as return target.
 * @returns {string} - Encoded return parameter value
 */
const currentReturn = (): string =>
  encodeURIComponent(window.location.pathname + window.location.search)

/**
 * Builds the login URL that returns to the current page.
 * @returns {string} - Login path with the return parameter
 */
export const loginUrl = (): string => `/auth/login?return=${currentReturn()}`

/**
 * Builds the sign-in page URL that returns to the current page.
 * @returns {string} - Sign-in page path with the return parameter
 */
export const signInPageUrl = (): string => `/auth/signin?return=${currentReturn()}`

/**
 * Starts the login with a full page navigation, the draft guard still asks first.
 * @returns {void}
 */
export const startLogin = (): void => {
  window.location.assign(loginUrl())
}

/**
 * Reacts to a 401 answer: a read navigates to the sign-in page once per page load, so an expired
 * session shows the page instead of an unasked new login; a write notifies. Header mode keeps
 * the plain error.
 * @param {boolean} isRead - Whether the request was a safe method
 * @returns {boolean} - True when the caller should stop, a navigation is under way
 */
export const handleUnauthorized = (isRead: boolean): boolean => {
  if (authMode === 'header') {
    return false
  }

  if (!isRead) {
    writeExpiredHandler?.()
    return false
  }

  if (redirected) {
    return false
  }

  redirected = true
  window.location.assign(signInPageUrl())
  return true
}

/**
 * Resets the module state, for tests.
 * @returns {void}
 */
export const resetSession = (): void => {
  authMode = null
  redirected = false
  writeExpiredHandler = null
}
