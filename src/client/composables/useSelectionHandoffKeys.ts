import { useSelectionAutoCheck } from '@/composables/useSelectionAutoCheck'
import { useSelectionHandoff } from '@/composables/useSelectionHandoff'
import { claudeKeyOf } from '@/keyboard/handoffKeymap'
import type { ShortcutScope } from '@/keyboard/triageKeymap'
import { useChecksStore } from '@/stores/checksStore'
import { useMcpStore } from '@/stores/mcpStore'
import { runUnlessBlocked } from '@/toast/blockedNotice'

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
    const key =
      scope === 'page' && mcp.enabled && selection.active.value ? claudeKeyOf(event) : null

    if (key === null || (key === 'autoCheck' && !checks.enabled)) {
      return false
    }

    if (key === 'autoCheck') {
      void autoCheck.runOrExplain()
      return true
    }

    runUnlessBlocked(key.blockedBy(selection), 'Not handed off', () => key.run(selection))
    return true
  }
}
