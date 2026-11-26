import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import type { AuthCookies } from '#server/auth/oidc/authCookies.ts'

export const SIGNED_OUT_TTL_SECONDS = 300

/**
 * Marks the browser as just signed out, so the round trip through the issuer's end-session
 * endpoint lands on the sign-in page with a signed-out note instead of a silent new login.
 * HttpOnly, SameSite=Lax (the return from the issuer is a top-level navigation), Path=/, five
 * minutes.
 * @param {Context} c - Request context
 * @param {AuthCookies} cookies - Cookie settings
 * @returns {void}
 */
export const setSignedOutCookie = (c: Context, cookies: AuthCookies): void => {
  setCookie(c, cookies.signedOutName, '1', {
    httpOnly: true,
    secure: cookies.secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: SIGNED_OUT_TTL_SECONDS,
  })
}

/**
 * Returns whether the request carries the signed-out marker.
 * @param {Context} c - Request context
 * @param {AuthCookies} cookies - Cookie settings
 * @returns {boolean} - True with the cookie
 */
export const hasSignedOutCookie = (c: Context, cookies: AuthCookies): boolean =>
  getCookie(c, cookies.signedOutName) !== undefined

/**
 * Clears the signed-out marker when the request carries it, with the flags it was set with.
 * @param {Context} c - Request context
 * @param {AuthCookies} cookies - Cookie settings
 * @returns {void}
 */
export const clearSignedOutCookie = (c: Context, cookies: AuthCookies): void => {
  if (!hasSignedOutCookie(c, cookies)) {
    return
  }

  deleteCookie(c, cookies.signedOutName, {
    httpOnly: true,
    secure: cookies.secure,
    sameSite: 'Lax',
    path: '/',
  })
}
