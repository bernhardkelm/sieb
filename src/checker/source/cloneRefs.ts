import { gitTagCandidates } from '#core/gitTagName.ts'
import type { CheckedRefKind } from '#core/privateAccess.ts'

/** One ref a clone fetches, with what it reports once checked out */
export interface CloneRef {
  fetch: string // full commit id, refs/tags/<name> or HEAD
  kind: CheckedRefKind
  ref: string | null // tag name for kind tag, else null
}

/**
 * Lists the refs a clone tries in order: the commit of the revision label, then the git tags
 * matching the image tag (the tag itself, then with a v prefix), then the default branch. latest
 * and digest-only images try no tag, and only names isGitTagName accepts reach git.
 * @param {string | null} commit - Full commit id of the revision label, null without one
 * @param {string | null} imageTag - Tag of the primary image, null for a digest-only image
 * @returns {CloneRef[]} - Refs, the default branch always last
 */
export const cloneRefs = (commit: string | null, imageTag: string | null): CloneRef[] => [
  ...(commit === null ? [] : [{ fetch: commit, kind: 'label' as const, ref: null }]),
  ...gitTagCandidates(imageTag).map((tag) => ({
    fetch: `refs/tags/${tag}`,
    kind: 'tag' as const,
    ref: tag,
  })),
  { fetch: 'HEAD', kind: 'default_branch', ref: null },
]

/**
 * Names a ref for a log line.
 * @param {CloneRef} ref - Ref
 * @returns {string} - Such as "commit <id>", "tag 1.4" or "the default branch"
 */
export const refLabel = (ref: CloneRef): string => {
  if (ref.kind === 'label') {
    return `commit ${ref.fetch}`
  }

  return ref.kind === 'tag' ? `tag ${ref.ref ?? ''}` : 'the default branch'
}
