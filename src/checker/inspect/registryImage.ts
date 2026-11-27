/** What registry_image answers about one image */
export interface ImageDescription {
  ref: string
  digest: string // digest the reference points to, of the index for a multi-platform image
  mediaType: string | null
  platforms: string[] | null // platforms of an index, null for a single-platform image
  config: {
    platform: string // platform the config was read for
    created: string | null
    labels: Record<string, string>
    baseImage: { name: string | null; digest: string | null } // OCI base image labels
    history: { created: string | null; createdBy: string; emptyLayer: boolean }[]
  }
}

const MAX_LABELS = 50
const MAX_LABEL_LENGTH = 300
const MAX_HISTORY = 60
const MAX_STEP_LENGTH = 300

interface RawConfig {
  created?: unknown
  config?: { Labels?: unknown }
  history?: unknown
}

interface RawManifest {
  mediaType?: unknown
  manifests?: { platform?: { os?: unknown; architecture?: unknown; variant?: unknown } }[]
}

/**
 * Parses a JSON answer of crane.
 * @param {string} text - JSON text
 * @param {string} what - Name for the error
 * @returns {T} - Parsed value
 * @throws {Error} - When the answer is no JSON object
 */
const parseJson = <T>(text: string, what: string): T => {
  try {
    const value: unknown = JSON.parse(text)

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as T
    }
  } catch {
    // reported below
  }

  throw new Error(`the registry answered no readable ${what}`)
}

/**
 * Returns a string value cut to a length, null for anything else.
 * @param {unknown} value - Raw value
 * @param {number} max - Longest kept text
 * @returns {string | null} - Text
 */
const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' ? value.slice(0, max) : null

/**
 * Returns the platforms of an image index, null for a single-platform manifest.
 * @param {RawManifest} manifest - Parsed manifest
 * @returns {string[] | null} - Platforms such as linux/arm/v7, attestations left out
 */
const platformsOf = (manifest: RawManifest): string[] | null => {
  if (!Array.isArray(manifest.manifests)) {
    return null
  }

  return manifest.manifests
    .map((entry) => entry.platform)
    .filter((platform) => platform !== undefined && platform.os !== 'unknown')
    .map((platform) =>
      [platform?.os, platform?.architecture, platform?.variant]
        .filter((part) => typeof part === 'string' && part !== '')
        .join('/'),
    )
}

/**
 * Returns the labels of an image config, capped in number and length.
 * @param {unknown} raw - config.Labels
 * @returns {Record<string, string>} - Labels
 */
const labelsOf = (raw: unknown): Record<string, string> =>
  typeof raw === 'object' && raw !== null
    ? Object.fromEntries(
        Object.entries(raw)
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
          .slice(0, MAX_LABELS)
          .map(([key, value]) => [
            key.slice(0, MAX_LABEL_LENGTH),
            value.slice(0, MAX_LABEL_LENGTH),
          ]),
      )
    : {}

/**
 * Describes an image from what crane read: digest, platforms, creation time, labels, the OCI
 * base image labels and the build history, each capped.
 * @param {{ ref: string; digest: string; manifest: string; config: string; platform: string }} read - crane answers
 * @returns {ImageDescription} - Description
 * @throws {Error} - When manifest or config are no JSON objects
 */
export const describeImage = (read: {
  ref: string
  digest: string
  manifest: string
  config: string
  platform: string
}): ImageDescription => {
  const manifest = parseJson<RawManifest>(read.manifest, 'manifest')
  const config = parseJson<RawConfig>(read.config, 'image config')
  const labels = labelsOf(config.config?.Labels)
  const history = Array.isArray(config.history) ? (config.history as Record<string, unknown>[]) : []

  return {
    ref: read.ref,
    digest: read.digest,
    mediaType: text(manifest.mediaType, 200),
    platforms: platformsOf(manifest),
    config: {
      platform: read.platform,
      created: text(config.created, 64),
      labels,
      baseImage: {
        name: labels['org.opencontainers.image.base.name'] ?? null,
        digest: labels['org.opencontainers.image.base.digest'] ?? null,
      },
      history: history.slice(0, MAX_HISTORY).map((step) => ({
        created: text(step.created, 64),
        createdBy: text(step.created_by, MAX_STEP_LENGTH) ?? '',
        emptyLayer: step.empty_layer === true,
      })),
    },
  }
}
