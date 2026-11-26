import type { Hono } from 'hono'

import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { createApp, type AppDeps } from '#server/http/createApp.ts'
import { createSource } from '#server/sources/createSource.ts'
import {
  DEFAULT_PROMETHEUS_SERVICE,
  DEFAULT_SOURCE_QUERIES,
} from '#server/sources/sourceQueries.ts'
import { createSyncService } from '#server/sync/syncService.ts'

export const TEST_NOW = new Date('2026-06-01T12:00:00.000Z')

/**
 * Discards log lines.
 * @returns {void}
 */
export const quiet = (): void => {}

/**
 * Builds app dependencies over an empty in-memory database and the mock source with the KEV
 * source of the overrides, cisa by default, no sync run.
 * @param {Partial<AppDeps>} overrides - Dependencies to replace
 * @returns {AppDeps} - Dependencies
 */
export const testAppDeps = (overrides: Partial<AppDeps> = {}): AppDeps => {
  const db = openDatabase(MEMORY_DB)
  /**
   * Returns the fixed test time.
   * @returns {Date} - TEST_NOW
   */
  const clock = (): Date => TEST_NOW
  const kevSource = overrides.kevSource ?? 'cisa'
  const source = createSource(
    {
      source: 'mock',
      kevSource,
      kubeContext: null,
      prometheusService: DEFAULT_PROMETHEUS_SERVICE,
      prometheusUrl: 'http://prometheus:9090',
      queries: DEFAULT_SOURCE_QUERIES,
    },
    clock,
    () => null,
  )
  const sync = createSyncService({ db, source, clock, log: quiet })

  return { source: 'mock', kevSource, db, sync, clock, devUser: 'dev', log: quiet, ...overrides }
}

/**
 * Creates an app whose database holds the base mock fixtures from one real sync.
 * @param {Partial<AppDeps>} overrides - Dependencies to replace
 * @returns {Promise<{ app: Hono<AppEnv>; deps: AppDeps }>} - App and its dependencies
 */
export const syncedTestApp = async (
  overrides: Partial<AppDeps> = {},
): Promise<{ app: Hono<AppEnv>; deps: AppDeps }> => {
  const deps = testAppDeps(overrides)

  await deps.sync.syncNow()
  return { app: createApp(deps), deps }
}

/**
 * Sends a JSON request and parses the answer.
 * @param {Hono<AppEnv>} app - App
 * @param {string} path - Request path
 * @param {string} method - HTTP method
 * @param {unknown} body - JSON body, left out when undefined
 * @param {Record<string, string>} headers - Extra headers
 * @returns {Promise<{ status: number; body: T }>} - Status and parsed body
 */
export const requestJson = async <T = unknown>(
  app: Hono<AppEnv>,
  path: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: T }> => {
  const response = await app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  return { status: response.status, body: (await response.json()) as T }
}

/**
 * Reads the sieb_suppressed series of the metrics endpoint.
 * @param {Hono<AppEnv>} app - App
 * @returns {Promise<string[]>} - Sample lines of sieb_suppressed
 */
export const suppressedSeries = async (app: Hono<AppEnv>): Promise<string[]> =>
  (await (await app.request('/metrics')).text())
    .split('\n')
    .filter((line) => line.startsWith('sieb_suppressed{'))
