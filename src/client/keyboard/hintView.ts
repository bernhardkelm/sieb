import { bulkLabel } from '@/format/bulkCount'
import type { HintBulk } from '@/keyboard/hintActions'
import type { KeyboardHint } from '@/keyboard/keyboardHints'

export interface HintView {
  hint: KeyboardHint
  /** Visible label, with the count while the action acts on checked items */
  text: string
  /** Label naming the counted items for assistive technology, absent without a count */
  ariaLabel: string | undefined
  /** Block reason, else the partial tooltip while the action leaves checked items out */
  title: string | undefined
  /** Why the action cannot run now, null while it can */
  blockedBy: string | null
}

/**
 * Describes a shortcut hint: its label carries the count of the checked items the action acts
 * on, as the buttons of the selection bar do, and stays plain while it acts on the cursor row.
 * @param {KeyboardHint} hint - Shortcut hint
 * @param {string | null} blockedBy - Why its action cannot run now, null while it can
 * @param {HintBulk | null} bulk - Checked items its action acts on, null for the cursor row
 * @returns {HintView} - Label, accessible label, tooltip and block reason
 */
export const hintView = (
  hint: KeyboardHint,
  blockedBy: string | null,
  bulk: HintBulk | null,
): HintView => {
  if (bulk === null) {
    return {
      hint,
      text: hint.label,
      ariaLabel: undefined,
      title: blockedBy ?? undefined,
      blockedBy,
    }
  }

  const labels = bulkLabel(hint.label, bulk.count, bulk.noun, hint.template)

  return {
    hint,
    text: labels.text,
    ariaLabel: labels.ariaLabel === labels.text ? undefined : labels.ariaLabel,
    title: blockedBy ?? labels.partial,
    blockedBy,
  }
}
