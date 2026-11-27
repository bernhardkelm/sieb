import type { ImageAccessSources } from '#core/imageVisibility.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { readImageAccessSources } from '#server/visibility/imageAccessSources.ts'
import type { ProbeCandidate } from '#server/visibility/pullProber.ts'

const TOOL_PROBE_WAIT_MS = 3000

/**
 * Reads the image access sources of one tool call.
 * @param {McpToolDeps} deps - Database, public registries and credential vault
 * @returns {ImageAccessSources} - Sources for the rows of the call
 */
export const toolImageSources = (deps: McpToolDeps): ImageAccessSources =>
  readImageAccessSources(deps.db, {
    publicRegistries: deps.publicRegistries,
    credentialVault: deps.credentialVault ?? null,
  })

/**
 * Probes the own images of a tool answer that have no fresh pull probe, waiting at most 3 seconds.
 * @param {McpToolDeps} deps - Pull prober
 * @param {readonly ProbeCandidate[]} images - Images of the answer
 * @returns {Promise<void>}
 */
export const probeToolImages = async (
  deps: McpToolDeps,
  images: readonly ProbeCandidate[],
): Promise<void> => {
  await deps.pullProber?.probeOwn(images, TOOL_PROBE_WAIT_MS)
}
