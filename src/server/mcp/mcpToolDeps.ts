import type { RouteDeps } from '#server/http/RouteDeps.ts'
import type { RateLimiter } from '#server/mcp/mcpGuards.ts'

/** What MCP tools and prompts read through */
export interface McpToolDeps extends RouteDeps {
  baseUrl: string // absolute origin for links back into sieb: SIEB_PUBLIC_URL, else the origin the request reached sieb at
  publicRegistries: readonly string[] // registries whose images count as public for source access
  log: (message: string) => void
  proposalLimiter: RateLimiter // propose_decision calls per caller, shared by every request
}
