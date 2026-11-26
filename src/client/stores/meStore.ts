import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { SourceKind } from '#core/types.ts'
import { fetchHealth } from '@/api/healthApi'
import { fetchMe } from '@/api/meApi'
import { type AuthMode, setAuthMode } from '@/api/session'

/** Acting user and the source the server reads from, loaded once per page view */
export const useMeStore = defineStore('me', () => {
  const username = ref<string | null>(null)
  const authMode = ref<AuthMode>('header')
  const source = ref<SourceKind | null>(null)
  const loaded = ref(false)

  /**
   * Loads user and source; failures leave them unknown, the header simply shows less.
   * @returns {Promise<void>} - Resolves when both requests settled
   */
  const load = async (): Promise<void> => {
    const [me, health] = await Promise.allSettled([fetchMe(), fetchHealth()])

    username.value = me.status === 'fulfilled' ? me.value.username : null
    authMode.value = me.status === 'fulfilled' ? (me.value.authMode ?? 'header') : 'header'
    setAuthMode(me.status === 'fulfilled' ? authMode.value : null)
    source.value = health.status === 'fulfilled' ? health.value.source : null
    loaded.value = true
  }

  return { username, authMode, source, loaded, load }
})
