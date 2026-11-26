import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'

import { useInboxStore } from '@/stores/inboxStore'

const APP_NAME = 'sieb'

/**
 * Builds the browser tab title from the view title and the open Inbox count.
 * @param {string | undefined} view - Title of the current view
 * @param {number} open - Open Inbox items
 * @returns {string} - Title such as "(3) Triage · sieb", the count only when something waits
 */
export const documentTitle = (view: string | undefined, open: number): string => {
  const prefix = open > 0 ? `(${open}) ` : ''

  return view ? `${prefix}${view} · ${APP_NAME}` : `${prefix}${APP_NAME}`
}

/**
 * Keeps the browser tab title on the current view and the open Inbox count, so waiting items
 * show from another tab.
 * @returns {void}
 */
export const useDocumentTitle = (): void => {
  const route = useRoute()
  const inbox = useInboxStore()

  watchEffect(() => {
    document.title = documentTitle(route.meta.title, inbox.counts.total)
  })
}
