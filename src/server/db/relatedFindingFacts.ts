import type { ProposalRelatedFacts } from '#core/apiTypes.ts'
import type { FindingView } from '#core/findingView.ts'
import type { PackageVersion } from '#core/instance.ts'
import type { ProposalRelatedFinding } from '#core/proposal.ts'
import { sourceAccess } from '#core/sourceAccess.ts'

export interface RelatedFactsContext {
  findings: ReadonlyMap<number, FindingView> // every finding by id, resolved ones included
  versions: ReadonlyMap<number, PackageVersion[]>
  publicRegistries: readonly string[]
}

/**
 * Builds sieb's current facts on the related findings of a proposal: open or resolved, source
 * access, package versions and the governing decision; a finding sieb no longer holds keeps only
 * its id and note.
 * @param {readonly ProposalRelatedFinding[]} related - Related findings as filed
 * @param {RelatedFactsContext} context - Findings, their versions and the public registries
 * @returns {ProposalRelatedFacts[]} - Facts in the filed order
 */
export const relatedFindingFacts = (
  related: readonly ProposalRelatedFinding[],
  { findings, versions, publicRegistries }: RelatedFactsContext,
): ProposalRelatedFacts[] =>
  related.map(({ findingId, note }) => {
    const finding = findings.get(findingId)

    return {
      findingId,
      note,
      vulnId: finding?.vulnId ?? null,
      imageRef: finding?.imageRef ?? null,
      open: finding !== undefined && finding.resolvedAt === null,
      sourceAccess: finding
        ? sourceAccess(finding.imageRef, finding.owner, publicRegistries)
        : null,
      versions: versions.get(findingId) ?? [],
      decision: finding?.decision ?? null,
      effective: finding?.effective ?? null,
    }
  })
