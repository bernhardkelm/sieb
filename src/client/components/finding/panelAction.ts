import { getCurrentInstance, inject, type InjectionKey } from 'vue'

/** Provided by the finding side panel, runs when the user acts on the finding it shows */
export const PANEL_ACTION: InjectionKey<() => void> = Symbol('panelAction')

/**
 * Returns the action callback of the surrounding finding side panel, a no-op outside of one.
 * @returns {() => void} - Callback to run after an action of the user
 */
export const usePanelAction = (): (() => void) => {
  const action = getCurrentInstance() === null ? null : inject(PANEL_ACTION, null)

  return action ?? (() => {})
}
