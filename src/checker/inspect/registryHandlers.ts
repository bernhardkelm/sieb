import type { CallToolResult } from '@modelcontextprotocol/server'

import { errorMessage } from '#core/errorMessage.ts'
import type { CommandOutput, ExecCommand } from '#checker/inspect/execCommand.ts'
import { describeImage } from '#checker/inspect/registryImage.ts'
import { parsePlatform, parseRegistryRef } from '#checker/inspect/registryRef.ts'
import { toolError } from '#checker/inspect/inspectResult.ts'

/** What the registry tools need */
export interface RegistryDeps {
  root: string // working directory of crane, the workspace
  exec: ExecCommand
  path: string // PATH of crane
  timeoutMs: number
  maxBytes: number // answer cap per call
}

export interface RegistryTagsInput {
  repository: string
  prefix?: string
  limit?: number
}

export interface RegistryImageInput {
  ref: string
  platform?: string
}

/** One handler per registry tool */
export interface RegistryHandlers {
  registry_tags: (input: RegistryTagsInput) => Promise<CallToolResult>
  registry_image: (input: RegistryImageInput) => Promise<CallToolResult>
}

// a docker config directory that does not exist, so crane finds no login and pulls anonymously
const ANONYMOUS = { DOCKER_CONFIG: '/nonexistent/sieb-anonymous-registry' }
const LIST_MAX_BYTES = 4 * 1024 * 1024
const MANIFEST_MAX_BYTES = 256 * 1024
const CONFIG_MAX_BYTES = 1024 * 1024
const DEFAULT_TAGS = 100
export const DEFAULT_PLATFORM = 'linux/amd64'

/**
 * Creates the registry tools: anonymous crane calls on public images only, without a shell,
 * with PATH and a docker config that does not exist as environment, a timeout per call and
 * capped output.
 * @param {RegistryDeps} deps - Command runner and limits
 * @returns {RegistryHandlers} - Handlers by tool name
 */
export const createRegistryHandlers = (deps: RegistryDeps): RegistryHandlers => {
  /**
   * Runs one crane command and returns its output, or throws its failure as a message.
   * @param {string[]} args - crane arguments
   * @param {number} maxBytes - stdout cap
   * @returns {Promise<string>} - stdout
   * @throws {Error} - When crane timed out, was cut or failed
   */
  const crane = async (args: string[], maxBytes: number): Promise<string> => {
    const output: CommandOutput = await deps.exec('crane', args, {
      path: deps.path,
      cwd: deps.root,
      timeoutMs: deps.timeoutMs,
      maxBytes,
      env: ANONYMOUS,
    })

    if (output.timedOut) {
      throw new Error(`crane ${args[0]} timed out after ${deps.timeoutMs / 1000} s`)
    }

    if (output.code !== 0 && !output.truncated) {
      const reason = output.stderr.trim().split('\n').pop() ?? ''

      throw new Error(
        `crane ${args[0]} failed, the image may not be public or not exist: ${reason.slice(0, 300)}`,
      )
    }

    return output.stdout.toString('utf8')
  }

  /**
   * Answers a tool call with text cut to the answer cap.
   * @param {string} text - Answer
   * @returns {CallToolResult} - Text result
   */
  const capped = (text: string): CallToolResult => {
    const bytes = Buffer.from(text, 'utf8')
    const note =
      bytes.length > deps.maxBytes ? `\n[output truncated at ${deps.maxBytes} bytes]` : ''

    return {
      content: [
        { type: 'text', text: `${bytes.subarray(0, deps.maxBytes).toString('utf8')}${note}` },
      ],
    }
  }

  return {
    registry_tags: async ({ repository, prefix = '', limit = DEFAULT_TAGS }) => {
      try {
        const { repository: name } = parseRegistryRef(repository, 'none')
        const listing = await crane(['ls', '--omit-digest-tags', name], LIST_MAX_BYTES)
        const lines = listing.split('\n').filter(Boolean)
        const tags = lines.filter((tag) => tag.startsWith(prefix))
        const shown = tags.slice(0, limit)
        const scope = prefix === '' ? '' : ` starting with ${prefix}`
        const cut = Buffer.byteLength(listing) >= LIST_MAX_BYTES ? ', listing cut at 4 MiB' : ''
        const more = tags.length > shown.length ? ', narrow with prefix to see the rest' : ''

        return capped(
          `${tags.length} tags${scope} of ${name} in registry order, ${shown.length} shown${more}${cut}:\n${shown.join('\n')}`,
        )
      } catch (error) {
        return toolError(errorMessage(error))
      }
    },
    registry_image: async ({ ref, platform = DEFAULT_PLATFORM }) => {
      try {
        const image = parseRegistryRef(ref, 'required')
        const chosen = parsePlatform(platform)
        const digest = (await crane(['digest', image.ref], 1024)).trim()
        const manifest = await crane(['manifest', image.ref], MANIFEST_MAX_BYTES)
        const config = await crane(['config', '--platform', chosen, image.ref], CONFIG_MAX_BYTES)

        return capped(
          JSON.stringify(
            describeImage({ ref: image.ref, digest, manifest, config, platform: chosen }),
            null,
            1,
          ),
        )
      } catch (error) {
        return toolError(errorMessage(error))
      }
    },
  }
}
