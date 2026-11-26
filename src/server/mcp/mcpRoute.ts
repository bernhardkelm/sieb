import {
  getOAuthProtectedResourceMetadataUrl,
  requireBearerAuth,
} from '@modelcontextprotocol/server'
import type { Handler } from 'hono'
import type { JWTVerifyGetKey } from 'jose'

import type { ErrorBody } from '#core/apiTypes.ts'
import { createBearerVerifier, type BearerVerifiers } from '#server/auth/bearerVerifier.ts'
import { createDiscoveredJwks } from '#server/auth/discoveredJwks.ts'
import { createJwtVerifier } from '#server/auth/jwtVerifier.ts'
import { createPersonalTokenVerifier } from '#server/auth/personalTokenVerifier.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'
import { callerFromAuthInfo } from '#server/mcp/callerFromAuthInfo.ts'
import { createMcpServer } from '#server/mcp/createMcpServer.ts'
import { MCP_PATH, mcpEndpointUrl } from '#server/mcp/mcpEndpointUrl.ts'
import { createMcpEndpoint, type McpEndpoint } from '#server/mcp/mcpEndpoint.ts'
import { createRateLimiter } from '#server/mcp/mcpGuards.ts'
import type { OAuthConfig } from '#server/mcpConfigValues.ts'

export interface McpRouteDeps extends RouteDeps {
  publicUrl: string | null // origin sieb is reached at, null derives it from each request
  oauth: OAuthConfig | null
  version: string // sieb version reported in serverInfo
  log: (message: string) => void
  jwtKeys?: JWTVerifyGetKey // replaces the discovered issuer key set, for tests
}

/**
 * Returns the protected resource metadata URL advertised in 401 challenges.
 * @param {McpRouteDeps} deps - Public URL and OAuth settings
 * @returns {string | undefined} - URL, undefined without OAuth
 */
const metadataUrlOf = ({ publicUrl, oauth }: McpRouteDeps): string | undefined =>
  oauth === null || publicUrl === null
    ? undefined
    : getOAuthProtectedResourceMetadataUrl(new URL(MCP_PATH, publicUrl))

/**
 * Builds the personal token verifier and, with OAuth settings, the JWT verifier.
 * @param {McpRouteDeps} deps - Database, clock, OAuth settings, logger and optional keys
 * @returns {BearerVerifiers} - Verifiers
 */
const verifiersOf = (deps: McpRouteDeps): BearerVerifiers => ({
  personal: createPersonalTokenVerifier(deps),
  jwt:
    deps.oauth === null
      ? null
      : createJwtVerifier({
          oauth: deps.oauth,
          keys: deps.jwtKeys ?? createDiscoveredJwks(deps.oauth),
          clock: deps.clock,
          log: deps.log,
        }),
})

/**
 * Creates the /mcp handler, mounted after the Host, Origin and body guards. Identity comes only
 * from the bearer token, the forward-auth header is never read here. A request needs the
 * sieb:read scope, at most MCP_RATE_LIMIT requests per minute and caller pass, and a fresh MCP
 * server answers it statelessly.
 * @param {McpRouteDeps} deps - Tool dependencies, OAuth settings, version and logger
 * @returns {Handler<AppEnv>} - Handler for app.all('/mcp')
 */
export const createMcpRoute = (deps: McpRouteDeps): Handler<AppEnv> => {
  const verifiers = verifiersOf(deps)
  const resourceMetadataUrl = metadataUrlOf(deps)
  const limiter = createRateLimiter()
  let endpoint: McpEndpoint | null = null

  return async (c) => {
    const resource = mcpEndpointUrl(deps.publicUrl, c.req.raw)
    const gate = requireBearerAuth({
      verifier: createBearerVerifier(verifiers, resource),
      requiredScopes: ['sieb:read'],
      ...(resourceMetadataUrl === undefined ? {} : { resourceMetadataUrl }),
      ...(deps.publicUrl === null ? {} : { expectedResource: resource }),
    })
    const authInfo = await gate(c.req.raw)

    if (authInfo instanceof Response) {
      return authInfo
    }

    const caller = callerFromAuthInfo(authInfo)
    const retryAfter = limiter.hit(
      `${caller.via}:${caller.tokenId ?? caller.actor}`,
      deps.clock().getTime(),
    )

    if (retryAfter !== null) {
      c.header('Retry-After', String(retryAfter))
      return c.json<ErrorBody>({ error: 'rate_limited' }, 429)
    }

    endpoint ??= createMcpEndpoint((info) => createMcpServer(deps, info, deps.version), deps.log)

    return endpoint.fetch(c.req.raw, authInfo)
  }
}
