// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { NGINX, REDIS } from '#server/db/__tests__/dbFixtures.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'

import { AUTHENTIK, connectSeededServer, KEV_CVE } from './mcpFixtures.ts'
import { matchesAdvertisedSchema } from './mcpTestClient.ts'

interface SearchResult {
  total: number
  findings?: Record<string, unknown>[]
  groups?: Record<string, unknown>[]
  notes: string[]
}

/**
 * Calls search_findings and checks the result against the advertised output schema.
 * @param {Record<string, unknown>} args - Tool arguments
 * @param {Partial<McpToolDeps>} overrides - Dependencies to replace
 * @returns {Promise<SearchResult>} - Structured content
 */
const search = async (
  args: Record<string, unknown>,
  overrides: Partial<McpToolDeps> = {},
): Promise<SearchResult> => {
  const client = await connectSeededServer(overrides)
  const tool = (await client.listTools()).find((candidate) => candidate.name === 'search_findings')
  const result = await client.callTool('search_findings', args)
  const content = (result.structuredContent ?? {}) as Record<string, unknown>

  expect(result.isError).toBeFalsy()
  expect(tool && (await matchesAdvertisedSchema(tool, result.structuredContent))).toBe(true)
  expect(tool && (await matchesAdvertisedSchema(tool, { ...content, x: 1 }))).toBe(false)

  return result.structuredContent as unknown as SearchResult
}

/**
 * Returns the vulnId and image of every row.
 * @param {SearchResult} result - Search result
 * @returns {string[][]} - Pairs
 */
const pairs = (result: SearchResult): string[][] =>
  (result.findings ?? []).map((row) => [String(row.vulnId), String(row.imageRef)])

describe('search_findings', () => {
  it('carries the rules of an empty filtered search and of the filters in its descriptions', async () => {
    const client = await connectSeededServer()
    const tool = (await client.listTools()).find(
      (candidate) => candidate.name === 'search_findings',
    )
    const properties = (tool?.inputSchema.properties ?? {}) as Record<
      string,
      { description?: string }
    >

    expect(tool?.description).toContain(
      'A filtered search returning 0: say so in the first line of your answer before you widen' +
        ' it and name the widened filter ("None with exposure public; widened to all exposures:").',
    )
    expect(properties.exposure?.description).toContain(
      '"public" in a question means this public unless the user says registry or source',
    )
    expect(properties.decisionState?.description).toContain(
      'reopened means severity rose or it became KEV listed',
    )
  })

  it('lists open findings in inbox order with compact rows and relative links', async () => {
    const result = await search({})

    expect(result.total).toBe(4)
    expect(pairs(result)[0]).toEqual([KEV_CVE, AUTHENTIK])
    expect(result.findings?.[0]).toMatchObject({
      severity: 'Critical',
      score: 10,
      kev: true,
      exposure: 'public',
      versions: [{ package: 'liblzma5', installed: '5.6.0', fixed: '5.6.1' }],
      workloads: ['authentik/ReplicaSet/authentik-server-7f9c'],
      decisionState: 'undecided',
      url: expect.stringMatching(/^http:\/\/localhost:3100\/triage\?finding=\d+$/),
      untrusted: { title: 'xz backdoor' },
    })
  })

  it('combines name, severity, KEV and decision state filters', async () => {
    expect(
      pairs(await search({ namespaces: ['AUTHENTIK'], severity: ['Critical'], kev: true })),
    ).toEqual([[KEV_CVE, AUTHENTIK]])
    expect(
      pairs(await search({ packages: ['libssl*'], decisionState: ['undecided'], minScore: 5 })),
    ).toEqual([
      ['CVE-2025-1000', REDIS],
      ['CVE-2025-2000', NGINX],
    ])
    expect(pairs(await search({ images: [`${NGINX}:1.27`], decisionState: ['active'] }))).toEqual([
      ['CVE-2025-1000', NGINX],
    ])
    expect(pairs(await search({ fixable: false }))).toEqual([['CVE-2025-2000', NGINX]])
    expect(pairs(await search({ view: 'inbox', workloads: ['web*'] }))).toEqual([
      ['CVE-2025-2000', NGINX],
    ])
    expect(pairs(await search({ includeResolved: true, vulnIds: ['CVE-2023-*'] }))).toEqual([
      ['CVE-2023-0001', REDIS],
    ])
  })

  it('pages with total, limit and offset', async () => {
    const result = await search({ limit: 2, offset: 1 })

    expect(result).toMatchObject({ total: 4, offset: 1, limit: 2 })
    expect(result.findings).toHaveLength(2)
  })

  it('groups by image and package with counts, max severity and links', async () => {
    const byImage = await search({ groupBy: 'image' }, { baseUrl: 'https://sieb.example.com/' })

    expect(byImage.findings).toBeUndefined()
    expect(byImage.groups?.[0]).toEqual({
      key: AUTHENTIK,
      count: 1,
      maxSeverity: 'Critical',
      kevCount: 1,
      inboxCount: 1,
      imageCount: 1,
      vulnCount: 1,
      url: `https://sieb.example.com/images?image=${encodeURIComponent(AUTHENTIK)}`,
    })
    expect(byImage.groups?.map((group) => [group.key, group.count])).toEqual([
      [AUTHENTIK, 1],
      [NGINX, 2],
      [REDIS, 1],
    ])

    const byPackage = await search({ groupBy: 'package' })

    expect(byPackage.groups?.map((group) => [group.key, group.count, group.url])).toEqual([
      ['liblzma5', 1, null],
      ['libssl3', 3, null],
    ])
  })

  it('filters by KEV date added and notes when the KEV source cannot', async () => {
    expect(pairs(await search({ kevAddedSince: '2026-05-25' }))).toEqual([[KEV_CVE, AUTHENTIK]])
    expect(pairs(await search({ kevAddedSince: '2026-05-29' }))).toEqual([])

    const prometheus = await search({ kevAddedSince: '2026-05-29' }, { kevSource: 'prometheus' })

    expect(prometheus.total).toBe(4)
    expect(prometheus.notes).toEqual([expect.stringContaining('kevAddedSince was ignored')])
  })

  it('rejects arguments outside the schema', async () => {
    const client = await connectSeededServer()
    const result = await client.callTool('search_findings', { limit: 51 })

    expect(result.isError).toBe(true)
  })
})
