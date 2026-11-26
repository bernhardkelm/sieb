// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { buildSnapshot, NGINX, REDIS } from '#server/db/__tests__/dbFixtures.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

import { MCP_NOW, connectSeededServer } from './mcpFixtures.ts'
import { matchesAdvertisedSchema, type McpTestClient } from './mcpTestClient.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Output = Record<string, any> // tool output read loosely in assertions

const GO = {
  vulnId: 'CVE-2099-10001',
  imageRef: NGINX,
  package: 'stdlib',
  installedVersion: 'v1.22.7',
  packageType: 'gobinary',
  packageClass: 'lang-pkgs',
  purl: 'pkg:golang/stdlib@v1.22.7',
}

const FOUND_IN = {
  package: 'stdlib',
  installed: 'v1.22.7',
  packageType: 'gobinary',
  purl: 'pkg:golang/stdlib@v1.22.7',
  paths: ['usr/local/bin/nginx-exporter', 'usr/local/bin/helper'],
}

/**
 * Connects a client to a database with a Go CVE found in two binaries of nginx and, without any
 * origin data, in redis.
 * @returns {Promise<McpTestClient>} - Connected client
 */
const connect = async (): Promise<McpTestClient> => {
  const db = openDatabase(MEMORY_DB)

  applySnapshot(
    db,
    buildSnapshot([
      { ...GO, locations: [{ target: 'usr/local/bin/nginx-exporter', pkgPath: null }] },
      { ...GO, locations: [{ target: 'usr/local/bin/helper', pkgPath: null }] },
      { vulnId: GO.vulnId, imageRef: REDIS, package: 'stdlib', installedVersion: 'v1.22.7' },
    ]),
    MCP_NOW,
  )

  return connectSeededServer({ db })
}

/**
 * Calls a tool and checks the result against its advertised output schema.
 * @param {McpTestClient} client - Connected client
 * @param {string} name - Tool name
 * @param {Record<string, unknown>} args - Arguments
 * @returns {Promise<Output>} - Structured content
 */
const call = async (
  client: McpTestClient,
  name: string,
  args: Record<string, unknown>,
): Promise<Output> => {
  const tool = (await client.listTools()).find((candidate) => candidate.name === name)
  const result = await client.callTool(name, args)

  expect(result.isError).toBeFalsy()
  expect(tool && (await matchesAdvertisedSchema(tool, result.structuredContent))).toBe(true)

  return result.structuredContent ?? {}
}

describe('foundIn of the finding tools', () => {
  it('get_finding lists the binaries, package type and PURL of the image', async () => {
    const client = await connect()
    const nginx = await call(client, 'get_finding', { vulnId: GO.vulnId, imageRef: NGINX })
    const redis = await call(client, 'get_finding', { vulnId: GO.vulnId, imageRef: REDIS })

    expect(nginx.foundIn).toEqual([FOUND_IN])
    expect(redis.foundIn).toEqual([])
  })

  it('check_vulnerability carries foundIn per affected image', async () => {
    const result = await call(await connect(), 'check_vulnerability', { vulnId: GO.vulnId })
    const byImage = new Map(
      (result.affected as Output[]).map((image) => [image.imageRef, image.foundIn]),
    )

    expect(byImage.get(NGINX)).toEqual([FOUND_IN])
    expect(byImage.get(REDIS)).toEqual([])
  })
})
