import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  HANDOFF_TARGET_STORAGE_KEY,
  TOUCH_QUERY,
  useHandoffTargetStore,
} from '@/stores/handoffTargetStore'

/**
 * Stubs matchMedia so only the given query matches.
 * @param {string | null} matching - Query that matches, null for none
 * @returns {void}
 */
const stubMedia = (matching: string | null): void => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: query === matching, media: query })),
  )
}

beforeEach(() => {
  localStorage.clear()
  stubMedia(null)
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('handoffTargetStore', () => {
  it('defaults to Claude Code in the Claude app', () => {
    expect(useHandoffTargetStore().preferred).toBe('desktop-code')
  })

  it('defaults to the Claude chat of the app on touch devices', () => {
    stubMedia(TOUCH_QUERY)

    expect(useHandoffTargetStore().preferred).toBe('desktop-chat')
  })

  it('remembers the picked default across page views', () => {
    useHandoffTargetStore().setPreferred('vscode')

    expect(localStorage.getItem(HANDOFF_TARGET_STORAGE_KEY)).toBe('vscode')

    setActivePinia(createPinia())
    stubMedia(TOUCH_QUERY)

    expect(useHandoffTargetStore().preferred).toBe('vscode')
  })

  it('ignores unknown stored values', () => {
    localStorage.setItem(HANDOFF_TARGET_STORAGE_KEY, 'jetbrains')

    expect(useHandoffTargetStore().preferred).toBe('desktop-code')
  })

  it('keeps the pick for the page view when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const store = useHandoffTargetStore()

    expect(store.preferred).toBe('desktop-code')

    store.setPreferred('cli')

    expect(store.preferred).toBe('cli')
  })
})
