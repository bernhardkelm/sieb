import { notifyNotice } from '@/toast/toastManager'

/**
 * Runs an action unless it is blocked, else names the reason in a neutral toast, for a key or a
 * tap that has no tooltip to show it.
 * @param {string | null} reason - Why the action cannot run, null while it can
 * @param {string} title - Toast title of a blocked action, such as "Not handed off"
 * @param {() => unknown} run - Action
 * @returns {boolean} - Whether the action ran
 */
export const runUnlessBlocked = (
  reason: string | null,
  title: string,
  run: () => unknown,
): boolean => {
  if (reason !== null) {
    notifyNotice(title, reason)
    return false
  }

  void run()
  return true
}
