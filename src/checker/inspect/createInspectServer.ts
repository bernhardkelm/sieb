import { McpServer, type ToolAnnotations } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { OBJDUMP_MODES, READELF_MODES, SYMBOL_PATTERN } from '#checker/inspect/inspectArgs.ts'
import type { InspectHandlers } from '#checker/inspect/inspectHandlers.ts'
import { DEFAULT_PLATFORM } from '#checker/inspect/registryHandlers.ts'
import { MAX_REF_LENGTH } from '#checker/inspect/registryRef.ts'

/** Name of the inspect server in the MCP config, its tools are mcp__inspect__<tool> */
export const INSPECT_SERVER_NAME = 'inspect'

const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: false }
const REGISTRY: ToolAnnotations = { readOnlyHint: true, openWorldHint: true }
const path = z
  .string()
  .min(1)
  .max(4096)
  .describe('file in the workspace, relative to it (for example image/usr/bin/curl) or absolute')
const filterShape = {
  pattern: z.string().min(1).max(200).optional(),
  regex: z.boolean().optional(),
  ignoreCase: z.boolean().optional(),
}

/**
 * Creates the inspect MCP server: read-only binary and archive inspection on workspace files,
 * and anonymous reads of public images in well-known registries.
 * @param {InspectHandlers} handlers - Tool handlers bound to the workspace
 * @returns {McpServer} - Server, connected to stdio by the entry point
 */
export const createInspectServer = (handlers: InspectHandlers): McpServer => {
  const server = new McpServer({ name: INSPECT_SERVER_NAME, version: '1.0.0' })
  const tool = { annotations: READ_ONLY }

  server.registerTool(
    'strings',
    {
      ...tool,
      title: 'Printable strings',
      description:
        'Runs strings -a on a file: printable strings of at least minLength characters, optionally only lines containing pattern (plain text, or an extended regular expression with regex true).',
      inputSchema: z.object({
        path,
        minLength: z.number().int().min(3).max(64).optional().describe('default 6'),
        ...filterShape,
      }),
    },
    (input) => handlers.strings(input),
  )
  server.registerTool(
    'readelf',
    {
      ...tool,
      title: 'ELF details',
      description:
        'Runs readelf on an ELF file in one view: header, sections, segments, dynamic (NEEDED libraries, RPATH), symbols, dynamic_symbols, notes (build id, ABI) or versions. Output is capped, so pass pattern (plain text, or an extended regular expression with regex true, ignoreCase optional) to keep only matching lines, for example one symbol in symbols.',
      inputSchema: z.object({
        path,
        mode: z.enum(Object.keys(READELF_MODES) as [keyof typeof READELF_MODES]),
        ...filterShape,
      }),
    },
    (input) => handlers.readelf(input),
  )
  server.registerTool(
    'objdump',
    {
      ...tool,
      title: 'Object file details',
      description:
        'Runs objdump on an object file: private_headers, section_headers, or disassemble_symbol with a symbol name to check whether and how a function is compiled in. Takes the same pattern filter as readelf.',
      inputSchema: z.object({
        path,
        mode: z.enum(OBJDUMP_MODES),
        symbol: z.string().regex(SYMBOL_PATTERN).optional(),
        ...filterShape,
      }),
    },
    (input) => handlers.objdump(input),
  )
  server.registerTool(
    'unzip_list',
    {
      ...tool,
      title: 'Archive listing',
      description: 'Lists the entries of a zip, jar, war or wheel archive without extracting it.',
      inputSchema: z.object({ path }),
    },
    (input) => handlers.unzip_list(input),
  )
  server.registerTool(
    'jq',
    {
      ...tool,
      title: 'JSON query',
      description:
        'Runs a jq filter on a .json file of the workspace, for example inventory.json or image-config.json.',
      inputSchema: z.object({ path, filter: z.string().min(1).max(500) }),
    },
    (input) => handlers.jq(input),
  )
  server.registerTool(
    'registry_tags',
    {
      annotations: REGISTRY,
      title: 'Image tags',
      description:
        'Lists the tags of a public image repository anonymously with crane ls, such as nginx/nginx-unprivileged or ghcr.io/owner/name, without tag or digest. prefix keeps only tags starting with it, limit caps the answer (default 100). Only well-known public registries.',
      inputSchema: z.object({
        repository: z.string().min(1).max(MAX_REF_LENGTH),
        prefix: z.string().max(128).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      }),
    },
    (input) => handlers.registry_tags(input),
  )
  server.registerTool(
    'registry_image',
    {
      annotations: REGISTRY,
      title: 'Image details',
      description: `Reads a public image by tag or digest anonymously with crane: the digest the reference points to now, its platforms, and for one platform (default ${DEFAULT_PLATFORM}) the creation time, labels, OCI base image labels and build history. Use it to check whether a tag was rebuilt after a fix, for example nginx/nginx-unprivileged:1.31.8-alpine.`,
      inputSchema: z.object({
        ref: z.string().min(1).max(MAX_REF_LENGTH),
        platform: z.string().max(50).optional().describe('such as linux/arm64 or linux/arm/v7'),
      }),
    },
    (input) => handlers.registry_image(input),
  )

  return server
}
