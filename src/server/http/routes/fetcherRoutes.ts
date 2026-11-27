import type { Context } from 'hono'
import { Hono } from 'hono'

import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { FetchAccess, SourceAnswer } from '#core/privateAccess.ts'
import { validateSourceRequest } from '#core/sourceRequestValidation.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import type { FetcherResult } from '#server/checks/fetcherCheck.ts'
import { fetchAccessFor } from '#server/checks/fetchAccess.ts'
import { sourceAnswerFor } from '#server/checks/sourceGrant.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { parseId } from '#server/http/pathParams.ts'
import { readValidBody } from '#server/http/requestBody.ts'
import { notFound, validationFailed } from '#server/http/responses.ts'

/**
 * Answers a fetcher command: 200 with the value, 404 for an unknown check, 409 once it is not
 * running or its finding has no pullable image left, 400 for an image the check did not claim.
 * No answer is cached.
 * @param {Context<AppEnv>} c - Request context
 * @param {FetcherResult<T>} result - Outcome
 * @returns {Response} - Response
 */
const fetcherAnswer = <T extends FetchAccess | SourceAnswer>(
  c: Context<AppEnv>,
  result: FetcherResult<T>,
): Response => {
  c.header('Cache-Control', 'no-store')

  if (result.ok) {
    return c.json(result.value)
  }

  if (result.error === 'not_found') {
    return notFound(c)
  }

  if (result.error === 'not_claimed') {
    return validationFailed(c, [{ field: 'imageRef', code: 'not_claimed' }])
  }

  return c.json<ErrorBody>(
    { error: result.error === 'not_running' ? 'check_not_running' : 'not_pullable' },
    409,
  )
}

/**
 * Creates the fetcher routes behind SIEB_FETCHER_SECRET: POST /checks/:id/access answers the
 * images and registry logins of a running check, POST /checks/:id/source resolves its repository
 * and answers the clone grant or why there is none.
 * @param {CheckContext} context - Check context with the credential vault
 * @returns {Hono<AppEnv>} - Routes, mounted at /worker
 */
export const createFetcherRoutes = (context: CheckContext): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.post('/checks/:id/access', (c) => {
    const id = parseId(c.req.param('id'))

    return id === null ? notFound(c) : fetcherAnswer(c, fetchAccessFor(context, id))
  })

  routes.post('/checks/:id/source', async (c) => {
    const id = parseId(c.req.param('id'))
    const input = await readValidBody(c, validateSourceRequest)

    if (!input.ok) {
      return input.response
    }

    return id === null ? notFound(c) : fetcherAnswer(c, sourceAnswerFor(context, id, input.value))
  })

  return routes
}
