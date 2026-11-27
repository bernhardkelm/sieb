/** Largest inventory.json handed to Claude */
export const INVENTORY_MAX_BYTES = 2 * 1024 * 1024

interface SyftArtifact {
  name?: unknown
  version?: unknown
  type?: unknown
  purl?: unknown
  locations?: ({ path?: unknown } | null)[]
}

interface SyftDocument {
  artifacts?: SyftArtifact[]
  distro?: unknown
  source?: { name?: unknown; type?: unknown }
}

/**
 * Reduces a syft artifact to the fields a triage needs.
 * @param {SyftArtifact} artifact - Syft artifact
 * @returns {Record<string, unknown>} - Name, version, type, purl and up to three paths
 */
const slimArtifact = (artifact: SyftArtifact): Record<string, unknown> => ({
  name: artifact.name,
  version: artifact.version,
  type: artifact.type,
  purl: artifact.purl,
  paths: (Array.isArray(artifact.locations) ? artifact.locations : [])
    .slice(0, 3)
    .map((location) => location?.path),
})

/**
 * Returns the inventory for Claude: the syft JSON as is while it is small, otherwise only the
 * distro and slim artifacts, cut to the size limit with the number of omitted artifacts.
 * @param {string} raw - syft JSON output
 * @param {number} maxBytes - Size limit
 * @returns {string} - Inventory JSON
 */
export const trimInventory = (raw: string, maxBytes: number = INVENTORY_MAX_BYTES): string => {
  if (Buffer.byteLength(raw) <= maxBytes) {
    return raw
  }

  let document: SyftDocument

  try {
    document = JSON.parse(raw) as SyftDocument
  } catch {
    return JSON.stringify({ error: 'syft output is not valid JSON' })
  }

  const artifacts = (Array.isArray(document.artifacts) ? document.artifacts : []).map(slimArtifact)
  const base = {
    trimmed: 'syft output reduced to name, version, type, purl and paths per artifact',
    distro: document.distro,
    source: { name: document.source?.name, type: document.source?.type },
    artifactCount: artifacts.length,
  }
  let kept = artifacts.length
  let text = JSON.stringify({ ...base, artifacts })

  while (Buffer.byteLength(text) > maxBytes && kept > 0) {
    kept = Math.floor(((kept * maxBytes) / Buffer.byteLength(text)) * 0.95)
    text = JSON.stringify({
      ...base,
      omittedArtifacts: artifacts.length - kept,
      artifacts: artifacts.slice(0, kept),
    })
  }

  return text
}
