import type { RouteDeps } from '#server/http/RouteDeps.ts'

/** What MCP tools and prompts read through */
export interface McpToolDeps extends RouteDeps {
  baseUrl: string // absolute origin for links back into sieb: SIEB_PUBLIC_URL, else the origin the request reached sieb at
}
