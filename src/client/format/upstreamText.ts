/** Label of a fix that waits for an upstream release */
export const UPSTREAM_PENDING_LABEL = 'Waiting for upstream'

/**
 * Describes what an upstream-pending fix waits for.
 * @param {string | null} waitingFor - Release or image awaited, null when not stated
 * @returns {string} - Such as "Waiting for upstream: k3s release bundling traefik 3.7.17"
 */
export const waitingForText = (waitingFor: string | null): string =>
  waitingFor ? `${UPSTREAM_PENDING_LABEL}: ${waitingFor}` : 'No upstream fix published yet'
