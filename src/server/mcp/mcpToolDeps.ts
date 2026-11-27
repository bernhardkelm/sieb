import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'
import type { RateLimiter } from '#server/mcp/mcpGuards.ts'
import type { PullProber } from '#server/visibility/pullProber.ts'

/** What MCP tools and prompts read through */
export interface McpToolDeps extends RouteDeps {
  baseUrl: string // absolute origin for links back into sieb: SIEB_PUBLIC_URL, else the origin the request reached sieb at
  publicRegistries: readonly string[] // third-party images on these registries count as public
  credentialVault?: CredentialVault | null // vault of usable credentials, null while private access is off
  pullProber?: PullProber | null // probes own images on demand, null in mock mode
  log: (message: string) => void
  proposalLimiter: RateLimiter // propose_decision calls per caller, shared by every request
  checksEnabled?: boolean // Auto-check on, pending checking then reads the open checks
}
