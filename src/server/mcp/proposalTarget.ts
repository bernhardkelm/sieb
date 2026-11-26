import type { ProposalTarget } from '#core/proposal.ts'
import { withoutImageTag } from '#core/nameMatch.ts'
import { getFinding, listFindingsByVuln } from '#server/db/findingRepository.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'

export interface ProposalTargetArgs {
  findingId?: number | undefined
  vulnId?: string | undefined
  imageRefs?: string[] | undefined
  all?: boolean | undefined
}

export type ResolvedTarget = { ok: true; target: ProposalTarget } | { ok: false; message: string }

const USAGE = 'pass findingId, or vulnId together with imageRefs or all: true'
const FINDING_ALONE =
  'findingId stands alone; pass findingId only, or vulnId together with imageRefs or all: true'

/**
 * Resolves the target of propose_decision to sieb's stored ids: a finding id to its
 * vulnerability and image, or a vulnerability id and image refs case-insensitively and without
 * tag or digest to the findings sieb holds. findingId combined with vulnId, imageRefs or all is
 * refused, never resolved to another target. Whether the findings are open is checked on create.
 * @param {McpToolDeps} deps - Database
 * @param {ProposalTargetArgs} args - Tool arguments naming the target
 * @returns {ResolvedTarget} - Target, or a message the model can act on
 */
export const resolveProposalTarget = (
  { db }: McpToolDeps,
  { findingId, vulnId, imageRefs, all }: ProposalTargetArgs,
): ResolvedTarget => {
  if (findingId !== undefined) {
    if (vulnId !== undefined || imageRefs !== undefined || all === true) {
      return { ok: false, message: FINDING_ALONE }
    }

    const finding = getFinding(db, findingId)

    return finding
      ? {
          ok: true,
          target: { vulnId: finding.vulnId, scope: 'image', imageRefs: [finding.imageRef] },
        }
      : { ok: false, message: `unknown finding ${findingId}` }
  }

  if (vulnId === undefined || (all === true) === (imageRefs !== undefined)) {
    return { ok: false, message: USAGE }
  }

  const findings = [...new Set([vulnId, vulnId.toUpperCase()])].flatMap((id) =>
    listFindingsByVuln(db, id),
  )
  const canonical = findings[0]?.vulnId

  if (canonical === undefined) {
    return { ok: false, message: `sieb has no finding of ${vulnId}; use check_vulnerability first` }
  }

  if (all === true) {
    return { ok: true, target: { vulnId: canonical, scope: 'all', imageRefs: null } }
  }

  const stored = new Map(
    findings.map((finding) => [finding.imageRef.toLowerCase(), finding.imageRef]),
  )
  const resolved = (imageRefs ?? []).map((ref) => stored.get(withoutImageTag(ref).toLowerCase()))
  const unknown = (imageRefs ?? []).filter((_, index) => resolved[index] === undefined)

  if (unknown.length > 0) {
    return {
      ok: false,
      message: `sieb has no finding of ${canonical} in ${unknown.join(', ')}; use check_vulnerability to list its images`,
    }
  }

  return {
    ok: true,
    target: {
      vulnId: canonical,
      scope: 'image',
      imageRefs: resolved.filter((ref) => ref !== undefined),
    },
  }
}
