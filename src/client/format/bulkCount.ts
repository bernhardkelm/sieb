import { countOf, formatCount } from '@/format/count'

/** Items a bulk action acts on out of the checked ones */
export interface BulkCount {
  /** Checked items the action acts on */
  affected: number
  /** Checked items */
  selected: number
  /** Why the action leaves the other checked items out, shown while it leaves some out */
  skipped: readonly string[]
}

/** Noun of the counted items in the accessible label */
export interface BulkNoun {
  singular: string
  plural?: string
}

export interface BulkLabel {
  /** Visible label, such as "Accept 4" */
  text: string
  /** Accessible label, such as "Accept 4 proposals" */
  ariaLabel: string
  /** Tooltip while the action leaves checked items out, such as "4 of 5 selected. ..." */
  partial: string | undefined
}

/**
 * Ends a reason with a full stop unless it ends in one already.
 * @param {string} reason - Reason text
 * @returns {string} - Reason as a sentence
 */
const sentence = (reason: string): string => (/[.!?]$/.test(reason) ? reason : `${reason}.`)

/**
 * Returns the tooltip of a bulk action that leaves checked items out.
 * @param {BulkCount} count - Affected and checked items with the skip reasons
 * @returns {string | undefined} - Such as "4 of 5 selected. Outdated proposals ...", undefined while it acts on all or none
 */
export const partialTitle = ({ affected, selected, skipped }: BulkCount): string | undefined => {
  if (affected === 0 || affected >= selected) {
    return undefined
  }

  const reasons = skipped.map(sentence).join(' ')

  return `${formatCount(affected)} of ${formatCount(selected)} selected.${reasons === '' ? '' : ` ${reasons}`}`
}

/**
 * Labels a bulk action with the number of items it acts on, after the label or at `{n}` of a
 * template where a trailing number would read as part of a name, such as "Copy {n} for Claude".
 * Without any items it keeps the plain label, its block reason explains why.
 * @param {string} label - Action label, such as "Accept"
 * @param {BulkCount} count - Affected and checked items with the skip reasons
 * @param {BulkNoun} noun - Noun of the items for the accessible label
 * @param {string} template - Label with `{n}` where the count goes, the count follows the label when omitted
 * @returns {BulkLabel} - Visible label, accessible label and partial tooltip
 */
export const bulkLabel = (
  label: string,
  count: BulkCount,
  noun: BulkNoun,
  template = `${label} {n}`,
): BulkLabel => {
  if (count.affected === 0) {
    return { text: label, ariaLabel: label, partial: undefined }
  }

  return {
    text: template.replace('{n}', formatCount(count.affected)),
    ariaLabel: template.replace('{n}', countOf(count.affected, noun.singular, noun.plural)),
    partial: partialTitle(count),
  }
}

/**
 * Counts an action that acts on every checked item.
 * @param {number} selected - Checked items
 * @returns {BulkCount} - Count without skips
 */
export const allOf = (selected: number): BulkCount => ({
  affected: selected,
  selected,
  skipped: [],
})
