import type { DecisionView } from '#core/findingView.ts'
import { containsSearch } from '@/components/filters/aggregateFilters'
import { JUSTIFICATION_LABELS } from '@/format/labels'

/**
 * Filters decisions by search text over vuln_id, image_ref, reason, justification label and
 * author, keeping their order.
 * @param {readonly T[]} views - Decisions with their state
 * @param {string} q - Search text, blank keeps every decision
 * @returns {T[]} - Matching decisions
 */
export const searchDecisions = <T extends Pick<DecisionView, 'decision'>>(
  views: readonly T[],
  q: string,
): T[] =>
  views.filter(({ decision }) =>
    containsSearch(
      [
        decision.vulnId,
        decision.imageRef ?? '',
        decision.reason,
        decision.justification ? JUSTIFICATION_LABELS[decision.justification] : '',
        decision.createdBy,
      ],
      q,
    ),
  )
