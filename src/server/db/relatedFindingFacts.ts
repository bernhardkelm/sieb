import type { ProposalRelatedFacts } from '#core/proposalApiTypes.ts'
import type { FindingView } from '#core/findingView.ts'
import type { PackageVersion } from '#core/instance.ts'
import type { ProposalRelatedFinding } from '#core/proposalRecord.ts'
import { imageAccessOf, type ImageAccessSources } from '#core/imageVisibility.ts'

export interface RelatedFactsContext {
  findings: ReadonlyMap<number, FindingView> // every finding by id, resolved ones included
  versions: ReadonlyMap<number, PackageVersion[]>
  sources: ImageAccessSources
}

/**
 * Builds sieb's current facts on the related findings of a proposal: open or resolved, image
 * visibility and ownership, package versions and the governing decision; a finding sieb no longer holds keeps only
 * its id and note.
 * @param {readonly ProposalRelatedFinding[]} related - Related findings as filed
 * @param {RelatedFactsContext} context - Findings, their versions and the image access sources
 * @returns {ProposalRelatedFacts[]} - Facts in the filed order
 */
export const relatedFindingFacts = (
  related: readonly ProposalRelatedFinding[],
  { findings, versions, sources }: RelatedFactsContext,
): ProposalRelatedFacts[] =>
  related.map(({ findingId, note }) => {
    const finding = findings.get(findingId)

    return {
      findingId,
      note,
      vulnId: finding?.vulnId ?? null,
      imageRef: finding?.imageRef ?? null,
      open: finding !== undefined && finding.resolvedAt === null,
      ...(finding ? imageAccessOf(finding, sources) : { imageVisibility: null, ownership: null }),
      versions: versions.get(findingId) ?? [],
      decision: finding?.decision ?? null,
      effective: finding?.effective ?? null,
    }
  })
