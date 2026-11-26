import type { Ref } from 'vue'

import { useFindingPanel } from '@/composables/useFindingPanel'
import { useListCursor } from '@/composables/useListCursor'
import type { ShortcutScope } from '@/keyboard/inboxKeymap'
import { listActionFor, type ListAction } from '@/keyboard/listKeymap'
import { rowByKey } from '@/keyboard/revealRow'
import { findingIdOfRowKey, findingRowKey, groupOfRowKey } from '@/keyboard/rowKey'
import { treeMoveFor } from '@/keyboard/treeNavigation'

export interface CursorListOptions {
  /** Row keys in display order, group rows and the finding rows of expanded groups */
  keys: Readonly<Ref<readonly string[]>>
  /** Runs Enter or o on a group row */
  activateGroup: (group: string) => void
  /** Runs Escape while the panel is closed, and ArrowLeft on the expanded group row */
  close?: () => void
  /** Expanded group, for ArrowRight and ArrowLeft */
  expanded?: () => string | null
  focusSearch?: () => void
  /** View keys checked before the list keys, returns whether it handled the event */
  viewKey?: (event: KeyboardEvent, scope: ShortcutScope, currentKey: string | null) => boolean
  /** Suspends the keys, for example while a dialog of the view is open */
  paused?: () => boolean
}

export interface CursorList {
  currentKey: Ref<string | null>
  select: (key: string) => void
  focusKey: (key: string) => Promise<void>
  refocus: () => Promise<void>
}

/**
 * Drives a keyboard list of group rows with expandable finding rows on the shared list cursor:
 * the shared cursor keys move, Enter or o expands a group or opens a finding in the side panel,
 * ArrowRight and ArrowLeft expand and collapse as in a tree view, Escape collapses, / searches.
 * @param {CursorListOptions} options - Rows and view callbacks
 * @returns {CursorList} - Cursor and its actions
 */
export const useCursorList = (options: CursorListOptions): CursorList => {
  const { findingId, openFinding } = useFindingPanel()

  /**
   * Expands a group row or opens a finding row in the panel.
   * @param {string} key - Row key
   * @returns {void}
   */
  const activate = (key: string): void => {
    const id = findingIdOfRowKey(key)
    const group = groupOfRowKey(key)

    if (id !== null) {
      void openFinding(String(id))
    } else if (group !== null) {
      options.activateGroup(group)
    }
  }

  /**
   * Runs ArrowRight or ArrowLeft on the cursor row.
   * @param {'in' | 'out'} direction - In for ArrowRight, out for ArrowLeft
   * @returns {boolean} - Whether the key did something on the row
   */
  const step = (direction: 'in' | 'out'): boolean => {
    const move = treeMoveFor(
      options.keys.value,
      cursor.currentKey.value,
      options.expanded?.() ?? null,
      direction,
    )

    switch (move?.kind) {
      case 'expand':
        options.activateGroup(move.group)
        return true
      case 'collapse':
        options.close?.()
        return options.close !== undefined
      case 'enter':
        cursor.move(1)
        return true
      case 'focus':
        void cursor.focusKey(move.key)
        return true
    }

    return false
  }

  /**
   * Runs a list action.
   * @param {ListAction} action - Action
   * @returns {boolean} - Whether the action applied
   */
  const run = (action: ListAction): boolean => {
    switch (action) {
      case 'expand':
      case 'collapse':
        return step(action === 'expand' ? 'in' : 'out')
      case 'activate':
        if (cursor.currentKey.value !== null) {
          activate(cursor.currentKey.value)
        }
        return true
      case 'close':
        if (findingId.value !== null || !options.close) {
          return false
        }
        options.close()
        return true
      case 'search':
        options.focusSearch?.()
        return options.focusSearch !== undefined
    }

    return false
  }

  const cursor = useListCursor<string>({
    keys: options.keys,
    findingIdOf: findingIdOfRowKey,
    keyOfFinding: findingRowKey,
    rowOf: rowByKey,
    paused: options.paused,
    handleKey: (event, scope) => {
      if (options.viewKey?.(event, scope, cursor.currentKey.value)) {
        return true
      }

      const action = listActionFor(event, scope)

      return action !== null && run(action)
    },
  })

  /**
   * Puts the cursor on a row and activates it, for clicks.
   * @param {string} key - Row key
   * @returns {void}
   */
  const select = (key: string): void => {
    cursor.currentKey.value = key
    activate(key)
  }

  return {
    currentKey: cursor.currentKey,
    select,
    focusKey: cursor.focusKey,
    refocus: cursor.refocus,
  }
}
