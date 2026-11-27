import type { CheckView } from '#core/check.ts'
import { NO_FAILURE_REASON } from '@/format/checkText'
import { shortImageName } from '@/format/imageName'

export interface CheckFinishNotice {
  title: string
  description: string
  /** Proposal the check filed, null without one or for a failed check */
  proposalId: number | null
  failed: boolean
}

/**
 * Builds the toast for an Auto-check of the user that ended.
 * @param {CheckView} check - Done or failed check
 * @returns {CheckFinishNotice} - Title such as "Auto-check done: CVE-1 · nginx", detail and proposal
 */
export const checkFinishNotice = (check: CheckView): CheckFinishNotice => {
  if (check.state === 'failed') {
    return {
      title: `Auto-check failed: ${check.vulnId}`,
      description: check.error ?? NO_FAILURE_REASON,
      proposalId: null,
      failed: true,
    }
  }

  return {
    title: `Auto-check done: ${check.vulnId} · ${shortImageName(check.imageRef)}`,
    description:
      check.proposalId === null ? 'Checked, no proposal' : `Proposal #${check.proposalId}`,
    proposalId: check.proposalId,
    failed: false,
  }
}
