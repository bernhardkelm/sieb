import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { isHandoffPreference, type HandoffPreference } from '@/format/handoffTargets'

export const HANDOFF_TARGET_STORAGE_KEY = 'sieb-handoff-target'

/** Touch devices without a precise pointer, phones and tablets, rarely run Claude Code */
export const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'

/**
 * Reads the remembered default action, null when storage is empty, invalid or blocked.
 * @returns {HandoffPreference | null} - Stored preference
 */
const readStored = (): HandoffPreference | null => {
  try {
    const stored = localStorage.getItem(HANDOFF_TARGET_STORAGE_KEY)

    return isHandoffPreference(stored) ? stored : null
  } catch {
    return null
  }
}

/**
 * Returns whether the device is touch only, where the chat of the Claude app is the likely client.
 * @returns {boolean} - True for a coarse pointer without hover
 */
const isTouchDevice = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(TOUCH_QUERY).matches

/**
 * Holds the default hand-off action: the remembered choice, otherwise Claude Code in the Claude
 * app, or the Claude chat of the Claude app on touch devices.
 */
export const useHandoffTargetStore = defineStore('handoffTarget', () => {
  const stored = ref<HandoffPreference | null>(readStored())
  const fallback: HandoffPreference = isTouchDevice() ? 'desktop-chat' : 'desktop-code'

  const preferred = computed<HandoffPreference>(() => stored.value ?? fallback)

  /**
   * Remembers the default action, it still applies for this page view when storage is blocked.
   * @param {HandoffPreference} preference - Picked default
   * @returns {void}
   */
  const setPreferred = (preference: HandoffPreference): void => {
    stored.value = preference

    try {
      localStorage.setItem(HANDOFF_TARGET_STORAGE_KEY, preference)
    } catch {
      // storage blocked
    }
  }

  return { preferred, setPreferred }
})
