import { readFile } from 'node:fs/promises'

import { isPlainObject } from '#core/isPlainObject.ts'

const LABEL_MAX_LENGTH = 2048
const SOURCE_LABEL = 'org.opencontainers.image.source'
const REVISION_LABEL = 'org.opencontainers.image.revision'

/** The OCI labels that name the source of an image */
export interface SourceLabels {
  sourceLabel: string | null
  revisionLabel: string | null
}

/**
 * Reads one label value.
 * @param {Record<string, unknown>} labels - Labels of the image config
 * @param {string} name - Label name
 * @returns {string | null} - Trimmed value, null when absent, empty or too long
 */
const label = (labels: Record<string, unknown>, name: string): string | null => {
  const value = labels[name]

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed === '' || trimmed.length > LABEL_MAX_LENGTH ? null : trimmed
}

/**
 * Reads the source and revision labels from an image-config.json the fetcher wrote.
 * @param {string} path - Path of image-config.json
 * @returns {Promise<SourceLabels>} - Both labels, null where the config names none
 */
export const readSourceLabels = async (path: string): Promise<SourceLabels> => {
  let config: unknown

  try {
    config = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return { sourceLabel: null, revisionLabel: null }
  }

  const inner = isPlainObject(config) && isPlainObject(config.config) ? config.config : {}
  const labels = isPlainObject(inner.Labels) ? inner.Labels : {}

  return { sourceLabel: label(labels, SOURCE_LABEL), revisionLabel: label(labels, REVISION_LABEL) }
}

/**
 * Returns whether a label names the same repository as a grant URL, ignoring case of the host,
 * a trailing slash and a .git suffix.
 * @param {string | null} sourceLabel - Source label of the image
 * @param {string} repoUrl - Normalised repository URL of the grant
 * @returns {boolean} - Whether both name one repository
 */
export const labelNamesRepo = (sourceLabel: string | null, repoUrl: string): boolean => {
  if (sourceLabel === null) {
    return false
  }

  /**
   * Reduces a repository URL to host and path.
   * @param {string} value - URL
   * @returns {string | null} - host/path without .git, null when it is no URL
   */
  const key = (value: string): string | null => {
    try {
      const url = new URL(value)

      return `${url.host}${url.pathname.replace(/\/+$/u, '').replace(/\.git$/u, '')}`.toLowerCase()
    } catch {
      return null
    }
  }

  const label = key(sourceLabel)

  return label !== null && label === key(repoUrl)
}
