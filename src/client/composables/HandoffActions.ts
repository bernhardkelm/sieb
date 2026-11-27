/** Hand-off actions of the keys and hints, for the panel finding or the checked rows */
export interface HandoffActions {
  /** Why the prompt cannot be handed off, null while it can */
  promptBlockedBy: () => string | null
  /** Why the default action cannot run: no prompt, or a deep link while Claude cannot reach sieb */
  openBlockedBy: () => string | null
  /** Why the claude command cannot be copied: none, or Claude cannot reach sieb */
  commandBlockedBy: () => string | null
  copyPrompt: () => Promise<boolean>
  copyCommand: () => Promise<boolean>
  /** Runs the default hand-off action, false while it is blocked */
  openPreferred: () => boolean
}
