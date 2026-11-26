import { isSuppressing } from '#core/effectiveDecision.ts'
import type { FindingKey } from '#core/finding.ts'
import type { Triage, TriageFinding } from '#core/triage.ts'

/** One sieb_suppressed series: an open finding whose governing decision silences alerts */
export type Suppression = FindingKey

/**
 * Collects one suppression per open finding whose governing decision is suppressing. An
 * all-scope decision thereby expands to the images it governs, so an image with its own expired
 * or re-opened decision stays unsilenced. Deduplicated and sorted for a stable exposition.
 * @param {Iterable<TriageFinding>} findings - Findings the triage was resolved over
 * @param {Triage} triage - Resolved triage
 * @returns {Suppression[]} - Suppressions sorted by vuln_id and image_ref
 */
export const collectSuppressions = (
  findings: Iterable<TriageFinding>,
  triage: Triage,
): Suppression[] => {
  const series = new Map<string, Suppression>()

  for (const finding of findings) {
    const governing = triage.byFinding.get(finding.id)

    if (finding.resolvedAt !== null || !governing || !isSuppressing(governing.effective)) {
      continue
    }

    series.set(JSON.stringify([finding.vulnId, finding.imageRef]), {
      vulnId: finding.vulnId,
      imageRef: finding.imageRef,
    })
  }

  return [...series.values()].sort(
    (a, b) => a.vulnId.localeCompare(b.vulnId) || a.imageRef.localeCompare(b.imageRef),
  )
}
