import type { HandoffActions } from '@/composables/usePanelHandoff'
import { useSelectionAutoCheck } from '@/composables/useSelectionAutoCheck'
import { useSelectionHandoff } from '@/composables/useSelectionHandoff'
import type { ShortcutScope } from '@/keyboard/triageKeymap'
import { useChecksStore } from '@/stores/checksStore'
import { useMcpStore } from '@/stores/mcpStore'
import { runUnlessBlocked } from '@/toast/blockedNotice'

interface KeyAction {
  run: (actions: HandoffActions) => unknown
  blockedBy: (actions: HandoffActions) => string | null
}

const KEYS: Record<string, KeyAction> = {
  h: { run: (actions) => actions.copyPrompt(), blockedBy: (actions) => actions.promptBlockedBy() },
  y: {
    run: (actions) => actions.copyCommand(),
    blockedBy: (actions) => actions.commandBlockedBy(),
  },
  H: {
    run: (actions) => actions.openPreferred(),
    blockedBy: (actions) => actions.openBlockedBy(),
  },
}

/**
 * Handles the Claude keys on the page of a list with checked rows: Shift+H runs the default
 * hand-off action, h copies the prompt, y the claude command, Shift+C queues an Auto-check (with
 * Auto-check on), for the whole selection. A blocked action names its reason in a toast, since
 * no button shows it. Inside the side panel the panel keys keep acting on the panel finding,
 * without checked rows nothing happens here.
 * @returns {(event: KeyboardEvent, scope: ShortcutScope) => boolean} - Key handler, true when it handled the key
 */
export const useSelectionHandoffKeys = (): ((
  event: KeyboardEvent,
  scope: ShortcutScope,
) => boolean) => {
  const mcp = useMcpStore()
  const checks = useChecksStore()
  const selection = useSelectionHandoff()
  const autoCheck = useSelectionAutoCheck()

  return (event, scope) => {
    if (
      scope !== 'page' ||
      !mcp.enabled ||
      !selection.active.value ||
      (['H', 'C'].includes(event.key) && !event.shiftKey)
    ) {
      return false
    }

    if (event.key === 'C') {
      if (!checks.enabled) {
        return false
      }

      void autoCheck.runOrExplain()
      return true
    }

    const action = KEYS[event.key]

    if (action === undefined) {
      return false
    }

    runUnlessBlocked(action.blockedBy(selection), 'Not handed off', () => action.run(selection))
    return true
  }
}
