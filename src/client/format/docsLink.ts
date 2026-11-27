export const AUTO_CHECK_DOCS_PATH = 'docs/auto-check.md'

const GITHUB_TREE = /^(https:\/\/github\.com\/[^/]+\/[^/]+)\/tree\/([^/?#]+)\/?$/

/**
 * Returns the link to a docs file of the running version, derived from the source code link
 * when it points at a GitHub tree; any other source link gives none.
 * @param {string | null} sourceCodeUrl - Source code link of the running version
 * @param {string} path - Path of the file in the repository, such as docs/auto-check.md
 * @returns {string | null} - URL of the file, null when it cannot be derived
 */
export const docsLinkOf = (sourceCodeUrl: string | null, path: string): string | null => {
  const match = sourceCodeUrl === null ? null : GITHUB_TREE.exec(sourceCodeUrl)

  return match === null ? null : `${match[1]}/blob/${match[2]}/${path}`
}
