import { Hono } from 'hono'

import type { ErrorBody, InboxResponse, InboxSeenResponse } from '#core/apiTypes.ts'
import { validateSeenKeys } from '#core/inbox/seenValidation.ts'
import { markSeen } from '#server/db/inboxRepository.ts'
import { inTransaction } from '#server/db/inTransaction.ts'
import { readInbox } from '#server/db/readInbox.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { requireActor } from '#server/http/identity.ts'
import { INVALID_BODY, readObjectBody } from '#server/http/requestBody.ts'
import { validationFailed } from '#server/http/responses.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'
import { requestOrigin } from '#server/mcp/mcpEndpointUrl.ts'

export type InboxRouteDeps = RouteDeps & {
  publicUrl: string | null // origin for item links, null derives it from the request
}

/**
 * Creates the Inbox routes of the acting user: GET / answers the items and counts, POST /seen
 * marks expiring and KEV items as seen for that user. Only keys listed in that user's Inbox right
 * now are marked, the others come back as ignored, so marking twice changes nothing. Both need an identity, since seen marks are per user; links use SIEB_PUBLIC_URL, else the
 * origin of the request.
 * @param {InboxRouteDeps} deps - Database, clock and public origin
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/inbox
 */
export const createInboxRoutes = ({ db, clock, publicUrl }: InboxRouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.use('*', async (c, next) => {
    if (c.get('actor') === null) {
      return c.json<ErrorBody>({ error: 'unauthorized' }, 401)
    }

    c.header('Cache-Control', 'no-store')
    await next()
  })

  routes.get('/', (c) =>
    c.json<InboxResponse>(
      readInbox(db, requireActor(c), clock(), publicUrl ?? requestOrigin(c.req.raw)),
    ),
  )

  routes.post('/seen', async (c) => {
    const body = await readObjectBody(c)
    const keys = body === null ? null : validateSeenKeys(body)

    if (keys === null || !keys.ok) {
      return validationFailed(c, keys?.errors ?? INVALID_BODY)
    }

    const actor = requireActor(c)
    const now = clock()
    const origin = publicUrl ?? requestOrigin(c.req.raw)
    const ignored = inTransaction(db, () => {
      const listed = new Set(readInbox(db, actor, now, origin).items.map((item) => item.key))
      const marked = keys.value.filter((key) => listed.has(key))

      markSeen(db, actor, marked, now)
      return keys.value.filter((key) => !listed.has(key))
    })
    const { counts } = readInbox(db, actor, now, origin)

    return c.json<InboxSeenResponse>({ counts, ignored })
  })

  return routes
}
