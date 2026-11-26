import type { LabelsResponse } from '#core/apiTypes.ts'
import type { Finding } from '#core/finding.ts'
import { distinctOwners } from '#core/owner.ts'

/**
 * Summarises which optional labels the open findings carry, so the client hides exposure and
 * owner where no open finding has them. Resolved findings are ignored.
 * @param {readonly Pick<Finding, 'exposure' | 'owner' | 'resolvedAt'>[]} findings - Findings
 * @returns {Pick<LabelsResponse, 'exposure' | 'owners'>} - Exposure presence and the distinct owners, self first
 */
export const summarizeFindingLabels = (
  findings: readonly Pick<Finding, 'exposure' | 'owner' | 'resolvedAt'>[],
): Pick<LabelsResponse, 'exposure' | 'owners'> => {
  const open = findings.filter((finding) => finding.resolvedAt === null)

  return {
    exposure: open.some((finding) => finding.exposure !== null),
    owners: distinctOwners(open.map((finding) => finding.owner)),
  }
}
