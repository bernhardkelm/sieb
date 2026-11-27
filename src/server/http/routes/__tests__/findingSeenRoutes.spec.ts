import { DAY_MS } from '#core/timeUnits.ts'
// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { ValidationErrorBody } from '#core/errorApiTypes.ts'
import type { FindingsSeenResponse } from '#core/findingApiTypes.ts'
import type { FindingView } from '#core/findingView.ts'
import { readSeenFindingIds } from '#server/db/findingSeenRepository.ts'
import { markSeen, readSeenMarks } from '#server/db/inboxRepository.ts'
import { createApp, type AppDeps } from '#server/http/createApp.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

import { buildSnapshot, NGINX, REDIS } from '#server/db/__tests__/dbFixtures.ts'
import { requestJson, TEST_NOW, testAppDeps } from '#server/http/__tests__/appFixtures.ts'

const ALICE = { 'X-authentik-username': 'alice' }
const BOB = { 'X-authentik-username': 'bob' }
const OLD = 1 // nginx, first seen ten days ago
const RECENT = 2 // redis, first seen a day ago

/**
 * Builds app dependencies without a dev user over an nginx finding first seen ten days ago and
 * a redis finding first seen a day ago.
 * @returns {AppDeps} - Dependencies
 */
const seededDeps = (): AppDeps => {
  const deps = testAppDeps({ devUser: null })
  const nginx = { imageRef: NGINX }

  applySnapshot(deps.db, buildSnapshot([nginx]), new Date(TEST_NOW.getTime() - 10 * DAY_MS), {
    initialImport: false,
  })
  applySnapshot(
    deps.db,
    buildSnapshot([nginx, { imageRef: REDIS, resourceName: 'cache-0' }]),
    new Date(TEST_NOW.getTime() - DAY_MS),
    { initialImport: false },
  )

  return deps
}

/**
 * Creates an app over the seeded dependencies.
 * @returns {ReturnType<typeof createApp>} - App
 */
const seededDepsApp = (): ReturnType<typeof createApp> => createApp(seededDeps())

/**
 * Lists the findings as a user sees them and answers id and seen per finding.
 * @param {ReturnType<typeof createApp>} app - App
 * @param {Record<string, string>} user - Identity header, none for an anonymous read
 * @returns {Promise<[number, boolean | undefined][]>} - Id and seen, by id
 */
const seenOf = async (
  app: ReturnType<typeof createApp>,
  user: Record<string, string> = {},
): Promise<[number, boolean | undefined][]> =>
  (await requestJson<FindingView[]>(app, '/api/findings', 'GET', undefined, user)).body
    .map((finding): [number, boolean | undefined] => [finding.id, finding.seen])
    .sort(([a], [b]) => a - b)

/**
 * Posts finding ids to mark them seen.
 * @param {ReturnType<typeof createApp>} app - App
 * @param {unknown} body - Request body
 * @param {Record<string, string>} headers - Extra headers
 * @returns {Promise<{ status: number; body: T }>} - Answer
 */
const post = <T = FindingsSeenResponse>(
  app: ReturnType<typeof createApp>,
  body: unknown,
  headers: Record<string, string> = ALICE,
) => requestJson<T>(app, '/api/findings/seen', 'POST', body, headers)

describe('finding seen routes', () => {
  it('marks recent findings seen per user and lists them with seen', async () => {
    const deps = seededDeps()
    const app = createApp(deps)

    expect(await seenOf(app, ALICE)).toEqual([
      [OLD, false],
      [RECENT, false],
    ])
    expect(await post(app, { ids: [RECENT, OLD, 99, RECENT] })).toEqual({
      status: 200,
      body: { ignored: [OLD, 99] },
    })
    expect(await post(app, { ids: [RECENT] })).toEqual({ status: 200, body: { ignored: [] } })
    expect(await seenOf(app, ALICE)).toEqual([
      [OLD, false],
      [RECENT, true],
    ])
    expect(await seenOf(app, BOB)).toEqual([
      [OLD, false],
      [RECENT, false],
    ])
    expect(await seenOf(app)).toEqual([
      [OLD, false],
      [RECENT, false],
    ])
    expect([...readSeenMarks(deps.db, 'alice').keys()]).toEqual([`finding:${RECENT}`])
  })

  it('needs an identity', async () => {
    const response = await post(seededDepsApp(), { ids: [RECENT] }, {})

    expect(response).toEqual({ status: 401, body: { error: 'unauthorized' } })
  })

  it('rejects bodies that are no id list, too long, or hold bad ids', async () => {
    const deps = seededDeps()
    const app = createApp(deps)

    expect(await post<ValidationErrorBody>(app, [RECENT])).toEqual({
      status: 400,
      body: { error: 'validation', errors: [{ field: null, code: 'invalid_body' }] },
    })
    expect((await post<ValidationErrorBody>(app, {})).body.errors).toEqual([
      { field: 'ids', code: 'required' },
    ])
    expect((await post<ValidationErrorBody>(app, { ids: 'finding:2' })).body.errors).toEqual([
      { field: 'ids', code: 'invalid' },
    ])
    expect(
      (await post<ValidationErrorBody>(app, { ids: Array.from({ length: 201 }, (_, i) => i + 1) }))
        .body.errors,
    ).toEqual([{ field: 'ids', code: 'too_many' }])
    expect(
      (await post<ValidationErrorBody>(app, { ids: [RECENT, 0, -1, 1.5, '2', 2 ** 53] })).body
        .errors,
    ).toEqual([
      { field: 'ids.1', code: 'invalid' },
      { field: 'ids.2', code: 'invalid' },
      { field: 'ids.3', code: 'invalid' },
      { field: 'ids.4', code: 'invalid' },
      { field: 'ids.5', code: 'invalid' },
    ])
    expect(readSeenFindingIds(deps.db, 'alice').size).toBe(0)
  })

  it('refuses cross-site writes', async () => {
    const response = await post(
      seededDepsApp(),
      { ids: [RECENT] },
      { ...ALICE, 'Sec-Fetch-Site': 'cross-site' },
    )

    expect(response).toEqual({ status: 403, body: { error: 'cross_site_request' } })
  })

  it('drops finding marks outside the window and keeps them out of the Inbox mark cap', async () => {
    const deps = seededDeps()
    const app = createApp(deps)

    deps.db
      .prepare('INSERT INTO inbox_seen (username, item_key, seen_at) VALUES (?, ?, ?)')
      .run('alice', `finding:${OLD}`, TEST_NOW.toISOString())
    await post(app, { ids: [RECENT] })
    markSeen(deps.db, 'alice', ['kev:1', 'kev:2'], TEST_NOW, 1)

    expect([...readSeenMarks(deps.db, 'alice').keys()].sort()).toEqual([
      `finding:${RECENT}`,
      'kev:2',
    ])
  })
})
