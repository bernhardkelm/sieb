import { splitImageRef } from '#core/imageRefParts.ts'
import type { SourceAnswer, SourceRequest } from '#core/privateAccess.ts'
import { commitRevision, resolveSourceTarget } from '#core/repositoryResolution.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import { handOut, runningCheck, type FetcherResult } from '#server/checks/fetcherCheck.ts'
import { listUsableScopes } from '#server/db/credentialRepository.ts'

/**
 * Returns whether the image a fetcher asks about is the check's image.
 * @param {string} requested - imageRef of the request
 * @param {string} claimed - imageRef of the check
 * @returns {boolean} - True for the same host and repository path
 */
const sameImage = (requested: string, claimed: string): boolean => {
  const a = splitImageRef(requested)
  const b = splitImageRef(claimed)

  return a !== null && b !== null && a.host === b.host && a.path === b.path
}

/**
 * Answers the fetcher's source request of a running check: resolves the repository from the
 * image's source label or a repository mapping and grants the clone with the covering git
 * credential. The revision label counts only for the label's own repository, or when the
 * image has no source label at all, since an inherited label names the base image's commit.
 * @param {CheckContext} context - Check context
 * @param {number} id - Check id
 * @param {SourceRequest} request - Labels the fetcher read from the pulled primary image
 * @returns {FetcherResult<SourceAnswer>} - Grant or skip, or a refusal
 */
export const sourceAnswerFor = (
  context: CheckContext,
  id: number,
  request: SourceRequest,
): FetcherResult<SourceAnswer> => {
  const check = runningCheck(context, id)

  if (typeof check === 'string') {
    return { ok: false, error: check }
  }

  if (!sameImage(request.imageRef, check.imageRef)) {
    return { ok: false, error: 'not_claimed' }
  }

  const scopes = listUsableScopes(context.db, context.privateVault)
  const target = resolveSourceTarget(scopes, check.imageRef, request.sourceLabel)

  if ('skip' in target) {
    return {
      ok: true,
      value: {
        skip: scopes.length === 0 && target.skip !== 'not_https' ? 'no_credential' : target.skip,
      },
    }
  }

  const { repoUrl } = target.repository
  const login = handOut(context, target.scope, { checkId: id, target: `git ${repoUrl}` })
  const revision =
    target.fromLabel || request.sourceLabel === null ? commitRevision(request.revisionLabel) : null

  return {
    ok: true,
    value: login === null ? { skip: 'no_credential' } : { grant: { repoUrl, revision, ...login } },
  }
}
