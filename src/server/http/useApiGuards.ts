import type { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import type { AuthMode, ErrorBody } from '#core/apiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { identity } from '#server/http/identity.ts'
import { writeGuard } from '#server/http/writeGuard.ts'

export const MAX_BODY_BYTES = 64 * 1024

export interface ApiGuardSetup {
  authMode: AuthMode
  userHeader: string // request header carrying the authenticated username
  devUser: string | null // acting user without an auth header, null answers anonymous writes 401
}

/**
 * Mounts the /api middleware in order: the same-origin JSON write guard, the MAX_BODY_BYTES body
 * limit and, in header mode, the forward-auth identity.
 * @param {Hono<AppEnv>} app - App, before any /api route is mounted
 * @param {ApiGuardSetup} setup - Auth mode, user header and dev user
 * @returns {void}
 */
export const useApiGuards = (
  app: Hono<AppEnv>,
  { authMode, userHeader, devUser }: ApiGuardSetup,
): void => {
  app.use('/api/*', writeGuard())
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json<ErrorBody>({ error: 'payload_too_large' }, 413),
    }),
  )
  if (authMode === 'header') {
    app.use('/api/*', identity(userHeader, devUser))
  }
}
