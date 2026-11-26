// @vitest-environment node
import type { GetPromptResult } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'

import { NGINX } from '#server/db/__tests__/dbFixtures.ts'
import { KEV_QUERY_NOTE } from '#server/mcp/views/advisoryFacts.ts'

import { AUTHENTIK, BASE_URL, connectSeededServer, INJECTION, KEV_CVE } from './mcpFixtures.ts'
import { matchesAdvertisedSchema, type McpTestClient } from './mcpTestClient.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Output = Record<string, any> // tool output read loosely in assertions

/**
 * Calls a tool and checks a successful result against its advertised output schema.
 * @param {McpTestClient} client - Connected client
 * @param {string} name - Tool name
 * @param {Record<string, unknown>} args - Arguments
 * @returns {Promise<Output>} - Structured content
 */
const call = async (
  client: McpTestClient,
  name: string,
  args: Record<string, unknown> = {},
): Promise<Output> => {
  const tool = (await client.listTools()).find((candidate) => candidate.name === name)
  const result = await client.callTool(name, args)

  expect(result.isError).toBeFalsy()
  expect(tool && (await matchesAdvertisedSchema(tool, result.structuredContent))).toBe(true)

  return result.structuredContent ?? {}
}

describe('query tool registration', () => {
  it('registers seven read-only, closed-world tools with output schemas', async () => {
    const tools = await (await connectSeededServer()).listTools()

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'check_vulnerability',
      'get_finding',
      'get_image',
      'get_overview',
      'list_decisions',
      'list_my_proposals',
      'search_findings',
    ])

    for (const tool of tools) {
      expect(tool.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
      expect(tool.outputSchema).toBeDefined()
    }
  })
})

describe('get_finding', () => {
  it('reads the same finding by id and by vulnId plus a tagged image ref', async () => {
    const client = await connectSeededServer({ baseUrl: 'https://sieb.example.com' })
    const byPair = await call(client, 'get_finding', {
      vulnId: 'cve-2025-1000',
      imageRef: `${NGINX}:1.27`,
    })
    const byId = await call(client, 'get_finding', { findingId: byPair.finding.id })

    expect(byId).toEqual(byPair)
    expect(byId.finding).toMatchObject({
      vulnId: 'CVE-2025-1000',
      imageRef: NGINX,
      decisionState: 'not_affected',
      url: `https://sieb.example.com/triage?finding=${byPair.finding.id}`,
    })
    expect(byId.decisions).toEqual([
      expect.objectContaining({ status: 'not_affected', governing: true, createdBy: 'alice' }),
    ])
    expect(byId.events).toEqual([expect.objectContaining({ type: 'created', actor: 'alice' })])
    expect(byId.instances).toHaveLength(1)
    expect(byId.cveUrl).toBe('https://sieb.example.com/cves?cve=CVE-2025-1000')
  })

  it('returns KEV details with catalog text under untrusted', async () => {
    const client = await connectSeededServer()
    const detail = await call(client, 'get_finding', { vulnId: KEV_CVE, imageRef: AUTHENTIK })
    const { untrusted, ...trusted } = detail

    expect(detail.kevCatalog).toEqual({
      dateAdded: '2026-05-28',
      dueDate: '2026-06-18',
      knownRansomware: false,
    })
    expect(untrusted.kev.vulnerabilityName).toBe(INJECTION)
    expect(JSON.stringify(trusted)).not.toContain(INJECTION)
    expect(detail.references.map((link: { label: string }) => link.label)).toEqual([
      'NVD',
      'KEV catalog',
    ])
  })

  it('names the KEV source and explains a null catalog with the Prometheus source', async () => {
    const cisa = await call(await connectSeededServer(), 'get_finding', {
      vulnId: KEV_CVE,
      imageRef: AUTHENTIK,
    })
    const prometheus = await call(
      await connectSeededServer({ kevSource: 'prometheus' }),
      'get_finding',
      {
        vulnId: KEV_CVE,
        imageRef: AUTHENTIK,
      },
    )

    expect(cisa).toMatchObject({ kevSource: 'cisa', kevNote: null })
    expect(prometheus).toMatchObject({
      finding: { kev: true },
      kevSource: 'prometheus',
      kevCatalog: null,
      kevNote: KEV_QUERY_NOTE,
    })
  })

  it('answers an unknown finding or missing arguments with an error result', async () => {
    const client = await connectSeededServer()

    expect((await client.callTool('get_finding', { findingId: 999 })).isError).toBe(true)
    expect((await client.callTool('get_finding', { vulnId: KEV_CVE })).isError).toBe(true)
    expect(
      (await client.callTool('get_finding', { vulnId: KEV_CVE, imageRef: NGINX })).isError,
    ).toBe(true)
  })
})

describe('get_image, list_decisions and get_overview', () => {
  it('reads an image aggregate with its open findings', async () => {
    const image = await call(await connectSeededServer(), 'get_image', {
      imageRef: NGINX.toUpperCase(),
    })

    expect(image.image).toMatchObject({
      imageRef: NGINX,
      openCount: 1,
      notAffectedCount: 1,
      inboxCount: 1,
      url: `${BASE_URL}/images?image=${encodeURIComponent(NGINX)}`,
    })
    expect(image.totalOpen).toBe(2)
    expect(image.findings.map((row: { vulnId: string }) => row.vulnId)).toEqual([
      'CVE-2025-1000',
      'CVE-2025-2000',
    ])
  })

  it('lists decisions filtered by package, image and state', async () => {
    const client = await connectSeededServer()

    expect(
      (await call(client, 'list_decisions', { package: 'libssl3', image: NGINX })).decisions,
    ).toEqual([
      expect.objectContaining({ vulnId: 'CVE-2025-1000', packages: ['libssl3'], state: 'active' }),
    ])
    expect((await call(client, 'list_decisions', { package: 'liblzma*' })).total).toBe(0)
    expect((await call(client, 'list_decisions', { state: 'revoked' })).total).toBe(0)
  })

  it('reads the overview counts, the last sync and the caller', async () => {
    const overview = await call(await connectSeededServer(), 'get_overview')

    expect(overview).toMatchObject({
      stats: { open: 4, inbox: 3, kev: 1, notAffected: 1, images: 3 },
      lastSync: { finishedAt: '2026-06-01T12:00:00.000Z' },
      kevSource: 'cisa',
      connectedAs: { actor: 'dev', via: 'token', client: 'laptop' },
      inboxUrl: `${BASE_URL}/inbox`,
    })
  })
})

/**
 * Returns the text of the first prompt message.
 * @param {GetPromptResult} prompt - Prompt result
 * @returns {string} - Text, empty for another content type
 */
const promptText = (prompt: GetPromptResult): string => {
  const content = prompt.messages[0]?.content

  return content?.type === 'text' ? content.text : ''
}

describe('triage_finding prompt', () => {
  it('names the finding and ends with the short answer of a read-only connection', async () => {
    const client = await connectSeededServer()
    const { finding } = await call(client, 'get_finding', { vulnId: KEV_CVE, imageRef: AUTHENTIK })
    const prompt = await client.getPrompt('triage_finding', { findingId: String(finding.id) })
    const text = promptText(prompt)

    expect(text).toContain(`${KEV_CVE} in the image ${AUTHENTIK}`)
    expect(text).toContain('vulnerable_code_not_in_execute_path')
    expect(text).toContain('Reply in the sieb format below')
  })

  it('takes a vulnerability id instead', async () => {
    const prompt = await (
      await connectSeededServer()
    ).getPrompt('triage_finding', { vulnId: KEV_CVE })

    expect(promptText(prompt)).toContain(`check_vulnerability { "vulnId": "${KEV_CVE}" }`)
  })
})
