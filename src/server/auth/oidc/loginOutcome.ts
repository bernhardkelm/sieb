import type { Context } from 'hono'

import type { AppEnv } from '#server/http/AppEnv.ts'
import {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from '#server/auth/oidc/authCookies.ts'
import { logSafe } from '#server/logSafe.ts'
import type { OidcAuthDeps } from '#server/auth/oidc/OidcAuthDeps.ts'
import { revokeLiveTokensOf } from '#server/db/apiTokenCleanup.ts'
import { createSession, deleteSession, deleteSessionsOf } from '#server/db/sessionRepository.ts'

const HOUR_MS = 60 * 60 * 1000

/**
 * Ends all access of a user the identity provider no longer admits to sieb: deletes every
 * session of the username, clears the session cookie and revokes the live personal tokens,
 * since neither a session nor /mcp asks the identity provider again.
 * @param {Context<AppEnv>} c - Request context
 * @param {Pick<OidcAuthDeps, 'db' | 'clock' | 'log' | 'cookies'>} deps - Database, clock, logger, cookies
 * @param {string} username - Refused user
 * @returns {void}
 */
export const revokeAccessOfRefused = (
  c: Context<AppEnv>,
  { db, clock, log, cookies }: Pick<OidcAuthDeps, 'db' | 'clock' | 'log' | 'cookies'>,
  username: string,
): void => {
  const sessions = deleteSessionsOf(db, username)
  const tokens = revokeLiveTokensOf(db, username, clock(), 'sieb')

  clearSessionCookie(c, cookies)
  if (sessions > 0 || tokens > 0) {
    log(
      `[sieb] ended ${sessions} sessions and revoked ${tokens} api tokens of ${logSafe(username)}, not in the required group`,
    )
  }
}

/**
 * Replaces the browser's previous session, if any, with a new one, sets its cookie and
 * redirects to the return path.
 * @param {Context<AppEnv>} c - Request context
 * @param {Pick<OidcAuthDeps, 'db' | 'clock' | 'log' | 'oidc' | 'cookies'>} deps - Database, clock, logger, session hours, cookies
 * @param {{ username: string; groups: string[] }} identity - Verified user
 * @param {string} idToken - ID token, kept as the logout hint
 * @param {string} returnTo - Validated relative path
 * @returns {Response} - Redirect
 */
export const startSession = (
  c: Context<AppEnv>,
  {
    db,
    clock,
    log,
    oidc,
    cookies,
  }: Pick<OidcAuthDeps, 'db' | 'clock' | 'log' | 'oidc' | 'cookies'>,
  identity: { username: string; groups: string[] },
  idToken: string,
  returnTo: string,
): Response => {
  const previous = readSessionCookie(c, cookies)

  if (previous !== undefined) {
    deleteSession(db, previous)
  }

  const id = createSession(
    db,
    { username: identity.username, groups: identity.groups, idToken },
    clock(),
    oidc.sessionHours * HOUR_MS,
  )

  setSessionCookie(c, cookies, id, oidc.sessionHours * 60 * 60)
  log(`[sieb] login ${logSafe(identity.username)}`)
  c.header('Cache-Control', 'no-store')
  return c.redirect(returnTo, 302)
}
