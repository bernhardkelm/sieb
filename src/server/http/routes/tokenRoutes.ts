import { Hono } from 'hono'

import type { ApiToken } from '#core/apiToken.ts'
import { validateTokenInput } from '#core/apiToken.ts'
import type { ApiTokenCreateResponse, ApiTokenView, ErrorBody } from '#core/apiTypes.ts'
import { displayPrefixOf, generateTokenSecret, hashTokenSecret } from '#server/auth/tokenSecrets.ts'
import { insertToken, listOwnTokens, revokeOwnToken } from '#server/db/apiTokenRepository.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { requireActor } from '#server/http/identity.ts'
import { parseId } from '#server/http/pathParams.ts'
import { INVALID_BODY, readObjectBody } from '#server/http/requestBody.ts'
import { notFound, validationFailed } from '#server/http/responses.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'

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
 * Formats the log line of a token change, never with the secret.
 * @param {string} change - What happened
 * @param {ApiToken} token - Token
 * @returns {string} - Log line
 */
const tokenLogLine = (change: string, token: ApiToken): string =>
  `[sieb] api token ${change}: owner=${JSON.stringify(token.owner)} ` +
  `name=${JSON.stringify(token.name)} id=${token.id} scope=${token.scope}`

/**
 * Creates the personal token routes of the acting user: GET / lists them, POST / creates one
 * and answers its secret once, POST /:id/revoke revokes one. Every route needs the forward-auth
 * identity, a user only ever sees and revokes their own tokens.
 * @param {TokenRouteDeps} deps - Database, clock and logger
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/tokens
 */
export const createTokenRoutes = ({ db, clock, log }: TokenRouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.use('*', async (c, next) => {
    if (c.get('actor') === null) {
      return c.json<ErrorBody>({ error: 'unauthorized' }, 401)
    }

    c.header('Cache-Control', 'no-store')
    await next()
  })

  routes.get('/', (c) =>
    c.json<ApiTokenView[]>(listOwnTokens(db, requireActor(c)).map(toTokenView)),
  )

  routes.post('/', async (c) => {
    const body = await readObjectBody(c)
    const now = clock()
    const input = body === null ? null : validateTokenInput(body, now)

    if (input === null || !input.ok) {
      return validationFailed(c, input?.errors ?? INVALID_BODY)
    }

    const secret = generateTokenSecret()
    const result = insertToken(
      db,
      {
        owner: requireActor(c),
        input: input.value,
        prefix: displayPrefixOf(secret),
        hash: hashTokenSecret(secret),
      },
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
