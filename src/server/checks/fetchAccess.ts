import { registryScopeFor } from '#core/accessScope.ts'
import { checkPullRef } from '#core/checkPull.ts'
import type { FetchAccess } from '#core/privateAccess.ts'
import { registryOf } from '#core/sourceAccess.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import { handOut, runningCheck, type FetcherResult } from '#server/checks/fetcherCheck.ts'
import { listUsableScopes } from '#server/db/credentialRepository.ts'
import { getFinding } from '#server/db/findingRepository.ts'
import { listInstances } from '#server/db/instanceRepository.ts'

/**
 * Answers the fetcher's access request of a running check: the images of the check's finding
 * as a claim names them, which the fetcher pulls instead of what the checker asks for, and the
 * login of the registry credential covering them, for the registry host as the claim names it
 * and for no other host.
 * @param {CheckContext} context - Check context
 * @param {number} id - Check id
 * @returns {FetcherResult<FetchAccess>} - Images and registry logins, no login for a public image, or a refusal
 */
export const fetchAccessFor = (context: CheckContext, id: number): FetcherResult<FetchAccess> => {
  const check = runningCheck(context, id)

  if (typeof check === 'string') {
    return { ok: false, error: check }
  }

  const finding = getFinding(context.db, check.findingId)
  const pull =
    finding === null ? null : checkPullRef(finding.imageRef, listInstances(context.db, finding.id))

  if (pull === null) {
    return { ok: false, error: 'not_pullable' }
  }

  const scope = registryScopeFor(listUsableScopes(context.db, context.privateVault), check.imageRef)
  const host = registryOf(check.imageRef)
  const login =
    scope === null || host === null
      ? null
      : handOut(context, scope, { checkId: id, target: `registry ${host}` })

  return {
    ok: true,
    value: {
      registries:
        login === null || host === null || scope === null
          ? []
          : [{ host, label: scope.label, ...login }],
      images: pull.images,
    },
  }
}
