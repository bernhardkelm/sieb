/** Authentication a registry asks for in its WWW-Authenticate header */
export type RegistryChallenge =
  | { scheme: 'bearer'; realm: string; service: string | null }
  | { scheme: 'basic' }

/**
 * Parses the WWW-Authenticate header of a registry: Bearer with realm and service as the OCI
 * distribution token flow uses it, or Basic.
 * @param {string | null} header - Header value
 * @returns {RegistryChallenge | null} - Challenge, null when missing or not understood
 */
export const parseChallenge = (header: string | null): RegistryChallenge | null => {
  const text = header?.trim() ?? ''
  const [scheme = '', ...rest] = text.split(/\s+/u)

  if (scheme.toLowerCase() === 'basic') {
    return { scheme: 'basic' }
  }

  if (scheme.toLowerCase() !== 'bearer') {
    return null
  }

  const params = new Map<string, string>()

  for (const match of rest.join(' ').matchAll(/([a-zA-Z]+)="([^"]*)"/gu)) {
    params.set((match[1] ?? '').toLowerCase(), match[2] ?? '')
  }

  const realm = params.get('realm')

  return realm ? { scheme: 'bearer', realm, service: params.get('service') ?? null } : null
}
