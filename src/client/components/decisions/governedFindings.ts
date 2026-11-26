import type { Decision } from '#core/decision.ts'
import type { FindingView } from '#core/findingView.ts'

type GovernedFinding = Pick<FindingView, 'vulnId' | 'imageRef' | 'resolvedAt' | 'decision'>

/**
 * Returns the open findings a decision governs. An image-scoped decision always lists the open
 * finding of its image, also after it was revoked or overruled, so it stays reachable; an
 * all-scope decision lists the open findings it currently governs.
 * @param {Pick<Decision, 'id' | 'vulnId' | 'scope' | 'imageRef'>} decision - Decision
 * @param {readonly T[]} findings - Findings in display order
 * @returns {T[]} - Governed open findings
 */
export const governedFindings = <T extends GovernedFinding>(
  decision: Pick<Decision, 'id' | 'vulnId' | 'scope' | 'imageRef'>,
  findings: readonly T[],
): T[] =>
  findings.filter(
    (finding) =>
      finding.resolvedAt === null &&
      finding.vulnId === decision.vulnId &&
      (decision.scope === 'image'
        ? finding.imageRef === decision.imageRef
        : finding.decision?.id === decision.id),
  )
