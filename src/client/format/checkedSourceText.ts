import type { CheckedSource } from '#core/privateAccess.ts'

const SHORT_REVISION_LENGTH = 7

/**
 * Returns the repository and what a check read of it: the tag matching the image tag, the
 * commit of the revision label, or the default branch, each commit shortened.
 * @param {CheckedSource} source - Checked out source
 * @returns {string} - Such as "gitlab.example.com/acme/shop at tag 1.1.3 (3f2a9c1)" or "…, default branch"
 */
export const checkedSourceText = (source: CheckedSource): string => {
  const repo = source.repoUrl.replace(/^https:\/\//u, '').replace(/\.git$/u, '')
  const commit = source.revision === null ? null : source.revision.slice(0, SHORT_REVISION_LENGTH)

  if (source.refKind === 'tag' && source.ref !== null) {
    return commit === null
      ? `${repo} at tag ${source.ref}`
      : `${repo} at tag ${source.ref} (${commit})`
  }

  if (source.refKind === 'label' && commit !== null) {
    return `${repo}@${commit}`
  }

  return commit === null ? `${repo}, default branch` : `${repo}, default branch (${commit})`
}
