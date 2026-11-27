import type { ServerResponse } from 'node:http'

import { failureReason } from '#checker/failureReason.ts'
import { send } from '#checker/fetcher/httpJson.ts'
import { parsePrepareRequest, parseReleaseRequest } from '#checker/fetcher/parsePrepareRequest.ts'
import type { PrepareAnswer, PrepareRequest } from '#checker/prepare/prepareTypes.ts'
import type { PulledImage } from '#checker/workspace/resolveImage.ts'

/** What the prepare and release routes need */
export interface RouteDeps {
  prepare: (
    request: PrepareRequest,
    signal: AbortSignal,
    onPulled: (images: PulledImage[]) => void,
  ) => Promise<PrepareAnswer>
  release: (checkId: number) => Promise<void>
  log: (line: string) => void
}

/** The route handlers and the shutdown of a running preparation */
export interface PrepareRoutes {
  prepare: (body: unknown, res: ServerResponse) => Promise<void>
  release: (body: unknown, res: ServerResponse) => Promise<void>
  stop: () => Promise<void>
}

/** The preparation in progress, the fetcher runs one at a time */
interface Running {
  checkId: number
  abort: AbortController
  done: Promise<unknown>
}

/**
 * Creates the prepare and release routes around one preparation at a time. A preparation stops
 * when the checker closes its request, and a release waits for it before wiping the check.
 * @param {RouteDeps} deps - Prepare and release calls and log
 * @returns {PrepareRoutes} - Route handlers and stop call
 */
export const createPrepareRoutes = (deps: RouteDeps): PrepareRoutes => {
  let running: Running | null = null

  /**
   * Runs one preparation and answers 200 with the workspace or 422 with the reason.
   * @param {unknown} body - Request body
   * @param {ServerResponse} res - Response
   * @returns {Promise<void>}
   */
  const prepare = async (body: unknown, res: ServerResponse): Promise<void> => {
    const request = parsePrepareRequest(body)

    if (request === null) {
      send(res, 400, { error: 'invalid prepare request' })

      return
    }

    if (running !== null) {
      send(res, 409, { error: `busy with check ${running.checkId}` })

      return
    }

    const abort = new AbortController()
    let pulled: PulledImage[] = []
    const run = deps.prepare(request, abort.signal, (images) => {
      pulled = images
    })

    res.on('close', () => {
      if (!res.writableFinished) {
        abort.abort('the checker closed the request')
      }
    })
    running = { checkId: request.checkId, abort, done: run.catch(() => undefined) }

    try {
      send(res, 200, await run)
    } catch (error) {
      const reason = failureReason(error, abort.signal)

      deps.log(`[sieb-fetcher] check ${request.checkId} failed: ${reason}`)
      send(res, 422, { error: reason, pulled })
    } finally {
      running = null
    }
  }

  /**
   * Stops a running preparation of the check and wipes its directories.
   * @param {unknown} body - Request body
   * @param {ServerResponse} res - Response
   * @returns {Promise<void>}
   */
  const release = async (body: unknown, res: ServerResponse): Promise<void> => {
    const checkId = parseReleaseRequest(body)

    if (checkId === null) {
      send(res, 400, { error: 'invalid release request' })

      return
    }

    const current = running

    if (current?.checkId === checkId) {
      current.abort.abort('released by the checker')
      await current.done
    }

    await deps.release(checkId)
    send(res, 204)
  }

  return {
    prepare,
    release,
    stop: async () => {
      const current = running

      current?.abort.abort('fetcher stopped')
      await current?.done
    },
  }
}
