// @vitest-environment node
import type { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

import type { SourceInstance } from '#core/sourceSnapshot.ts'
import { EXPOSURE_CAVEAT, EXPOSURE_MEANINGS } from '#core/exposureMeaning.ts'
import { buildSnapshot, NGINX } from '#server/db/__tests__/dbFixtures.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

import { AUTHENTIK, connectSeededServer, KEV_CVE, MCP_NOW } from './mcpFixtures.ts'
import { matchesAdvertisedSchema } from './mcpTestClient.ts'

const PUBLIC = `public: ${EXPOSURE_MEANINGS.public}`
const INTERNAL = `internal: ${EXPOSURE_MEANINGS.internal}`
const UNKNOWN = `unknown: ${EXPOSURE_MEANINGS.unknown}`

/**
 * Opens an in-memory database holding the given source rows.
 * @param {readonly Partial<SourceInstance>[]} rows - Row overrides
 * @returns {DatabaseSync} - Database
 */
const databaseWith = (rows: readonly Partial<SourceInstance>[]): DatabaseSync => {
  const db = openDatabase(MEMORY_DB)

  applySnapshot(db, buildSnapshot(rows), MCP_NOW)
  return db
}

/**
 * Calls a tool and returns the exposureNote of its result, checked against the output schema.
 * @param {string} name - Tool name
 * @param {Record<string, unknown>} args - Arguments
 * @param {DatabaseSync | undefined} db - Database replacing the seeded one
 * @returns {Promise<unknown>} - exposureNote of the structured content
 */
const noteOf = async (
  name: string,
  args: Record<string, unknown>,
  db?: DatabaseSync,
): Promise<unknown> => {
  const client = await connectSeededServer(db ? { db } : {})
  const tool = (await client.listTools()).find((candidate) => candidate.name === name)
  const result = await client.callTool(name, args)

  expect(result.isError).toBeFalsy()
  expect(tool && (await matchesAdvertisedSchema(tool, result.structuredContent))).toBe(true)

  return (result.structuredContent as Record<string, unknown> | undefined)?.exposureNote
}

describe('exposureNote in tool results', () => {
  it('explains the tier of a labelled finding, image and vulnerability', async () => {
    const publicNote = `${PUBLIC}\n${EXPOSURE_CAVEAT}`

    expect(await noteOf('get_finding', { vulnId: KEV_CVE, imageRef: AUTHENTIK })).toBe(publicNote)
    expect(await noteOf('get_image', { imageRef: AUTHENTIK })).toBe(publicNote)
    expect(await noteOf('check_vulnerability', { vulnId: KEV_CVE })).toBe(publicNote)
    expect(await noteOf('get_finding', { vulnId: 'CVE-2025-1000', imageRef: NGINX })).toBe(
      `${INTERNAL}\n${EXPOSURE_CAVEAT}`,
    )
  })

  it('explains every tier of a search page once, not per row', async () => {
    expect(await noteOf('search_findings', {})).toBe(`${PUBLIC}\n${INTERNAL}\n${EXPOSURE_CAVEAT}`)
  })

  it('adds unknown for an unlabelled finding next to labelled ones', async () => {
    const db = databaseWith([
      { imageRef: NGINX, exposure: null },
      { imageRef: AUTHENTIK, exposure: 'public' },
    ])

    expect(await noteOf('search_findings', {}, db)).toBe(
      `${PUBLIC}\n${UNKNOWN}\n${EXPOSURE_CAVEAT}`,
    )
  })

  it('is null when nothing in the result carries an exposure label', async () => {
    const db = databaseWith([{ imageRef: NGINX, exposure: null }])

    expect(await noteOf('get_finding', { vulnId: 'CVE-2025-1000', imageRef: NGINX }, db)).toBeNull()
    expect(await noteOf('get_image', { imageRef: NGINX }, db)).toBeNull()
    expect(await noteOf('check_vulnerability', { vulnId: 'CVE-2025-1000' }, db)).toBeNull()
    expect(await noteOf('check_vulnerability', { vulnId: 'CVE-2099-0001' })).toBeNull()
    expect(await noteOf('search_findings', {}, db)).toBeNull()
  })

  it('leaves the note out of grouped counts', async () => {
    expect(await noteOf('search_findings', { groupBy: 'image' })).toBeUndefined()
  })
})
