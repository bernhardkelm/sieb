import type { IDToken } from 'openid-client'

import { readUsername } from '#server/auth/readUsername.ts'

export type LoginIdentityResult =
  | { ok: true; username: string; groups: string[] }
  | { ok: false; error: 'missing_username' }
  | { ok: false; error: 'missing_group'; username: string }

/**
 * Reads the acting user from verified ID token claims. preferred_username is the authentik
 * username, the same value the forward-auth header carried, so decision history stays
 * consistent across auth modes. With a required group the groups claim must list it exactly.
 * @param {IDToken | undefined} claims - Verified ID token claims
 * @param {string | null} requiredGroup - Group a user must have, null admits every user
 * @returns {LoginIdentityResult} - Username and groups, or why the login is refused
 */
export const loginIdentity = (
  claims: IDToken | undefined,
  requiredGroup: string | null,
): LoginIdentityResult => {
  const username = readUsername(claims?.preferred_username)

  if (username === null) {
    return { ok: false, error: 'missing_username' }
  }

  const groups = Array.isArray(claims?.groups)
    ? claims.groups.filter((group): group is string => typeof group === 'string')
    : []

  if (requiredGroup !== null && !groups.includes(requiredGroup)) {
    return { ok: false, error: 'missing_group', username }
  }

  return { ok: true, username, groups }
}
