import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import { LOGIN_TX_TTL_MS } from '#server/auth/oidc/loginTxSeal.ts'

export const SECURE_SESSION_COOKIE = '__Host-sieb_session'
export const PLAIN_SESSION_COOKIE = 'sieb_session'
export const SECURE_LOGIN_TX_COOKIE = '__Host-sieb_login'
export const PLAIN_LOGIN_TX_COOKIE = 'sieb_login'
export const SECURE_SIGNED_OUT_COOKIE = '__Host-sieb_signedout'
export const PLAIN_SIGNED_OUT_COOKIE = 'sieb_signedout'

/** Names and flags of the auth cookies, derived from the scheme of the public URL */
export interface AuthCookies {
  secure: boolean // https public URL: Secure flag and __Host- cookies
  sessionName: string
  loginTxName: string
  signedOutName: string
}

/**
 * Derives the cookie settings from the public URL. Over https all cookies carry the __Host-
 * prefix with Secure, so they bind to this exact host and a sibling subdomain cannot plant them;
 * over plain http, only allowed outside production, they drop prefix and Secure, which the
 * browser would refuse otherwise.
 * @param {string} publicUrl - Public origin
 * @returns {AuthCookies} - Cookie settings
 */
export const authCookiesFor = (publicUrl: string): AuthCookies => {
  const secure = new URL(publicUrl).protocol === 'https:'

  return {
    secure,
    sessionName: secure ? SECURE_SESSION_COOKIE : PLAIN_SESSION_COOKIE,
    loginTxName: secure ? SECURE_LOGIN_TX_COOKIE : PLAIN_LOGIN_TX_COOKIE,
    signedOutName: secure ? SECURE_SIGNED_OUT_COOKIE : PLAIN_SIGNED_OUT_COOKIE,
  }
}

/**
 * Reads the session id cookie.
 * @param {Context} c - Request context
 * @param {AuthCookies} cookies - Cookie settings
 * @returns {string | undefined} - Session id, undefined without the cookie
 */
export const readSessionCookie = (c: Context, cookies: AuthCookies): string | undefined =>
  getCookie(c, cookies.sessionName)

/**
 * Sets the session cookie: HttpOnly, SameSite=Lax (the return from the issuer is a top-level
 * navigation), Path=/, no Domain, Max-Age the absolute session lifetime.
 * @param {Context} c - Request context
 * @param {AuthCookies} cookies - Cookie settings
 * @param {string} id - Session id
 * @param {number} maxAgeSeconds - Session lifetime
 * @returns {void}
 */
export const setSessionCookie = (
  c: Context,
  cookies: AuthCookies,
  id: string,
  maxAgeSeconds: number,
): void => {
  setCookie(c, cookies.sessionName, id, {
    httpOnly: true,
    secure: cookies.secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: maxAgeSeconds,
  })
}

/**
 * Clears the session cookie with the same flags it was set with.
 * @param {Context} c - Request context
 * @param {AuthCookies} cookies - Cookie settings
 * @returns {void}
 */
export const clearSessionCookie = (c: Context, cookies: AuthCookies): void => {
  deleteCookie(c, cookies.sessionName, {
    httpOnly: true,
    secure: cookies.secure,
    sameSite: 'Lax',
    path: '/',
  })
}

/**
 * Sets the login transaction cookie for the transaction lifetime, Path=/ as __Host- requires.
 * @param {Context} c - Request context
 * @param {AuthCookies} cookies - Cookie settings
 * @param {string} sealed - Sealed pending login
 * @returns {void}
 */
export const setLoginTxCookie = (c: Context, cookies: AuthCookies, sealed: string): void => {
  setCookie(c, cookies.loginTxName, sealed, {
    httpOnly: true,
    secure: cookies.secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: LOGIN_TX_TTL_MS / 1000,
  })
}

/**
 * Reads and clears the login transaction cookie, which is single use.
 * @param {Context} c - Request context
 * @param {AuthCookies} cookies - Cookie settings
 * @returns {string | undefined} - Sealed pending login, undefined without the cookie
 */
export const takeLoginTxCookie = (c: Context, cookies: AuthCookies): string | undefined => {
  const txId = getCookie(c, cookies.loginTxName)

  if (txId !== undefined) {
    deleteCookie(c, cookies.loginTxName, {
      httpOnly: true,
      secure: cookies.secure,
      sameSite: 'Lax',
      path: '/',
    })
  }

  return txId
}
