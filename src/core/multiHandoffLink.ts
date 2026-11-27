import { fitsLink, type HandoffClient } from '#core/handoffLinks.ts'
import { composeMultiPrompt, listedFindings } from '#core/multiHandoffPrompt.ts'
import type { MultiHandoffFinding } from '#core/multiHandoffRepositoryLine.ts'

export interface MultiLinkPrompt {
  /** Prompt short enough for a deep link, null when the selection does not fit */
  prompt: string | null
  /** Most findings of the selection, counted from the first, a link can carry */
  max: number
}

/**
 * Counts how many findings, from the first, fit a link in the compact form.
 * Binary search, the compact prompt only grows with every added finding.
 * @param {readonly MultiHandoffFinding[]} findings - Findings
 * @param {HandoffClient} client - Client kind
 * @returns {number} - Count, 0 when not even one fits
 */
export const maxFitting = (
  findings: readonly MultiHandoffFinding[],
  client: HandoffClient,
): number => {
  let low = 0
  let high = findings.length

  while (low < high) {
    const mid = Math.ceil((low + high) / 2)

    if (fitsLink(composeMultiPrompt(findings.slice(0, mid), client, false))) {
      low = mid
    } else {
      high = mid - 1
    }
  }

  return low
}

/**
 * Builds the prompt a deep link carries for several findings: the full prompt when it fits,
 * else the compact one without image refs, which get_finding returns anyway. A selection too
 * large for either gets no link prompt, so a link never carries a cut-off list.
 * @param {readonly MultiHandoffFinding[]} findings - Selected findings in selection order
 * @param {HandoffClient} client - Client kind of the target
 * @returns {MultiLinkPrompt} - Link prompt and the most findings a link can carry
 */
export const multiLinkPrompt = (
  findings: readonly MultiHandoffFinding[],
  client: HandoffClient,
): MultiLinkPrompt => {
  const listed = listedFindings(findings)

  if (listed.length === findings.length) {
    const full = composeMultiPrompt(listed, client)

    if (fitsLink(full)) {
      return { prompt: full, max: findings.length }
    }

    const compact = composeMultiPrompt(listed, client, false)

    if (fitsLink(compact)) {
      return { prompt: compact, max: findings.length }
    }
  }

  return { prompt: null, max: maxFitting(listed, client) }
}
