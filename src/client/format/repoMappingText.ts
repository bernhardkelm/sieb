import { defaultRepoMapping } from '#core/defaultRepoMapping.ts'
import type { AccessProvider } from '#core/privateAccess.ts'

/**
 * Returns the mapping a credential with both uses gets without an explicit one, as a hint.
 * @param {AccessProvider} provider - Provider of the credential
 * @param {string} registryHost - Registry host as entered
 * @param {string} gitHost - Git host as entered
 * @returns {string | null} - Hint text, null when the provider or a host has no default mapping
 */
export const defaultMappingText = (
  provider: AccessProvider,
  registryHost: string,
  gitHost: string,
): string | null => {
  const mapping = defaultRepoMapping(provider, registryHost.trim() || null, gitHost.trim() || null)

  if (mapping === null) {
    return null
  }

  const path = mapping.segments === null ? '<path>' : '<owner>/<name>'
  const longest = mapping.segments === null ? ', the longest project path first' : ''

  return `Default: ${mapping.registryHost}/${path} → ${mapping.gitHost}/${path}${longest}; images are matched to the git tag of the same name, or with a v in front.`
}
