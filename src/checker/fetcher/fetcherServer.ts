import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import { readJson, send } from '#checker/fetcher/httpJson.ts'
import { localAuth } from '#checker/fetcher/localAuth.ts'
import { createPrepareRoutes, type RouteDeps } from '#checker/fetcher/prepareRoutes.ts'

/** What the local endpoint needs */
export interface FetcherServerDeps extends RouteDeps {
  secret: string // SIEB_FETCHER_LOCAL_SECRET
}

/** The local endpoint and its shutdown */
export interface FetcherServer {
  server: Server
  stop: () => Promise<void> // aborts a running preparation and closes the listener
}

/**
 * Creates the fetcher's local endpoint for the checker of the same pod: POST /ready, /prepare
 * and /release, each with the local secret as bearer token.
 * @param {FetcherServerDeps} deps - Secret, prepare and release calls and log
 * @returns {FetcherServer} - Server, not yet listening, and its stop call
 */
export const createFetcherServer = (deps: FetcherServerDeps): FetcherServer => {
  const authorized = localAuth(deps.secret)
  const routes = createPrepareRoutes(deps)

  /**
   * Routes one request after checking method and bearer token.
   * @param {IncomingMessage} req - Request
   * @param {ServerResponse} res - Response
   * @returns {Promise<void>}
   */
  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST') {
      send(res, 405)

      return
    }

    if (!authorized(req.headers.authorization)) {
      send(res, 401)

      return
    }

    const body = await readJson(req)

    if (req.url === '/ready') {
      send(res, 204)
    } else if (req.url === '/prepare') {
      await routes.prepare(body, res)
    } else if (req.url === '/release') {
      await routes.release(body, res)
    } else {
      send(res, 404)
    }
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) {
        send(res, 500)
      }
    })
  })

  return {
    server,
    stop: async () => {
      server.close()
      await routes.stop()
    },
  }
}
