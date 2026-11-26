import type { FindingKey } from '#core/finding.ts'

/** Images of one CVE a bulk decision targets */
export interface BulkTarget {
  vulnId: string
  imageRefs: string[] | 'all-open'
}

/**
 * Returns the targets of a bulk decision: the checked findings grouped per CVE, or without
 * checked findings every open image of the CVE under the cursor.
 * @param {readonly (FindingKey & { id: number })[]} findings - Listed findings in display order
 * @param {ReadonlySet<number>} checkedIds - Checked finding ids
 * @param {number | null} currentId - Finding under the cursor
 * @returns {BulkTarget[]} - One group per CVE, empty when nothing applies
 */
export const bulkTargetsFor = (
  findings: readonly (FindingKey & { id: number })[],
  checkedIds: ReadonlySet<number>,
  currentId: number | null,
): BulkTarget[] => {
  const checked = findings.filter((finding) => checkedIds.has(finding.id))

  if (checked.length === 0) {
    const current = findings.find((finding) => finding.id === currentId)

    return current ? [{ vulnId: current.vulnId, imageRefs: 'all-open' }] : []
  }

  const groups = new Map<string, string[]>()

  for (const finding of checked) {
    groups.set(finding.vulnId, [...(groups.get(finding.vulnId) ?? []), finding.imageRef])
  }

  return [...groups].map(([vulnId, imageRefs]) => ({ vulnId, imageRefs }))
}
