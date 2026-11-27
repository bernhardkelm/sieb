import { Hono } from 'hono'

import type { ApiToken } from '#core/apiToken.ts'
import { validateTokenInput } from '#core/apiToken.ts'
import type { ErrorBody } from '#core/errorApiTypes.ts'
import type {
  ApiTokenCleanupResponse,
  ApiTokenCreateResponse,
  ApiTokenView,
} from '#core/tokenApiTypes.ts'
import { newTokenSecret } from '#server/auth/tokenSecrets.ts'
import { deleteInactiveTokensOf, deleteOwnInactiveToken } from '#server/db/apiTokenCleanup.ts'
import { listOwnTokens, revokeOwnToken } from '#server/db/apiTokenRepository.ts'
import { insertToken } from '#server/db/apiTokenWrites.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { requireActor } from '#server/http/identity.ts'
import { noStore } from '#server/http/noStore.ts'
import { parseId } from '#server/http/pathParams.ts'
import { readValidBody } from '#server/http/requestBody.ts'
import { notFound } from '#server/http/responses.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'
import { tokenLogLine } from '#server/tokenLogLine.ts'

export type TokenRouteDeps = RouteDeps & { log: (message: string) => void }

/**
 * Maps a token to its API view, which never carries the owner, hash or secret.
 * @param {ApiToken} token - Token
 * @returns {ApiTokenView} - View
 */
export const toTokenView = (token: ApiToken): ApiTokenView => ({
  id: token.id,
  name: token.name,
  scope: token.scope,
  prefix: token.prefix,
  createdAt: token.createdAt,
  expiresAt: token.expiresAt,
  lastUsedAt: token.lastUsedAt,
  revokedAt: token.revokedAt,
})

/**
 * Creates the personal token routes of the acting user: GET / lists them, POST / creates one
 * and answers its secret once, POST /:id/revoke revokes one, DELETE /:id deletes a revoked or
 * expired one and POST /cleanup deletes all of those. Every route needs the forward-auth
 * identity, a user only ever sees, revokes and deletes their own tokens.
 * @param {TokenRouteDeps} deps - Database, clock and logger
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/tokens
 */
export const createTokenRoutes = ({ db, clock, log }: TokenRouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.use('*', async (c, next) => {
    if (c.get('actor') === null) {
      return c.json<ErrorBody>({ error: 'unauthorized' }, 401)
    }

    await next()
  })
  routes.use('*', noStore())

  routes.get('/', (c) =>
    c.json<ApiTokenView[]>(listOwnTokens(db, requireActor(c)).map(toTokenView)),
  )

  routes.post('/', async (c) => {
    const now = clock()
    const input = await readValidBody(c, (body) => validateTokenInput(body, now))

    if (!input.ok) {
      return input.response
    }

    const { secret, prefix, hash } = newTokenSecret()
    const result = insertToken(
      db,
      { owner: requireActor(c), input: input.value, prefix, hash },
      now,
    )

    if (!result.ok) {
      return c.json<ErrorBody>({ error: result.error }, 409)
    }

    log(tokenLogLine('created', result.token))
    return c.json<ApiTokenCreateResponse>({ token: toTokenView(result.token), secret }, 201)
  })

  routes.post('/:id/revoke', (c) => {
    const id = parseId(c.req.param('id'))
    const token = id === null ? null : revokeOwnToken(db, requireActor(c), id, clock())

    if (token === null) {
      return notFound(c)
    }

    log(tokenLogLine('revoked', token))
    return c.json<ApiTokenView>(toTokenView(token))
  })

  routes.delete('/:id', (c) => {
    const id = parseId(c.req.param('id'))
    const result = id === null ? null : deleteOwnInactiveToken(db, requireActor(c), id, clock())

    if (result === null || (!result.ok && result.error === 'not_found')) {
      return notFound(c)
    }

    if (!result.ok) {
      return c.json<ErrorBody>({ error: result.error }, 409)
    }

    log(tokenLogLine('deleted', result.token))
    return c.body(null, 204)
  })

  routes.post('/cleanup', (c) => {
    const deleted = deleteInactiveTokensOf(db, requireActor(c), clock())

    for (const token of deleted) {
      log(tokenLogLine('deleted', token))
    }

    return c.json<ApiTokenCleanupResponse>({ deleted: deleted.length })
  })

  return routes
}

/**
 * Creates the stand-in of the token routes while MCP is disabled: every request answers 404
 * mcp_disabled, stored tokens stay untouched.
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/tokens
 */
export const createMcpDisabledRoutes = (): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.all('*', (c) => c.json<ErrorBody>({ error: 'mcp_disabled' }, 404))

  return routes
}
