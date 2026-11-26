import { watch, type Ref } from 'vue'

import { useQueryParam } from '@/composables/useQueryParam'
import { INBOX_ITEM_QUERY } from '@/router/routeNames'

/**
 * Opens an Inbox link of the form `/inbox?item=<key>`, as the markers in the list views and the
 * finding panel use: once the Inbox is loaded the cursor lands on the listed item and focuses
 * it, then the param leaves the URL so later refetches leave the cursor alone. A key that is no
 * longer listed is dropped without moving the cursor.
 * @param {Readonly<Ref<readonly string[]>>} keys - Listed item keys in display order
 * @param {Readonly<Ref<boolean>>} loaded - Whether the Inbox answered once
 * @param {(key: string) => Promise<void>} focusKey - Puts the cursor on a row and focuses it
 * @returns {void}
 */
export const useInboxItemLink = (
  keys: Readonly<Ref<readonly string[]>>,
  loaded: Readonly<Ref<boolean>>,
  focusKey: (key: string) => Promise<void>,
): void => {
  const { value: itemKey, set } = useQueryParam(INBOX_ITEM_QUERY)

  watch(
    [itemKey, keys, loaded],
    async ([key, listed, ready]) => {
      if (key === null || !ready) {
        return
      }

      if (listed.includes(key)) {
        await focusKey(key)
      }

      await set(null)
    },
    { immediate: true },
  )
}
