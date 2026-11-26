import { describe, expect, it } from 'vitest'
import { nextTick, ref, type Ref } from 'vue'

import { useListSelection, type ListSelection } from '@/composables/useListSelection'

/**
 * Creates a selection over rows 1 to 6 with the cursor on a row.
 * @param {number} cursor - Row the cursor starts on
 * @returns {{ ids: Ref<number[]>, selection: ListSelection<number> }} - Rows and selection
 */
const setup = (cursor: number): { ids: Ref<number[]>; selection: ListSelection<number> } => {
  const ids = ref([1, 2, 3, 4, 5, 6])
  const selection = useListSelection(ids)

  selection.currentId.value = cursor
  return { ids, selection }
}

const checked = (selection: ListSelection<number>): number[] => selection.checkedInOrder.value

describe('useListSelection', () => {
  it('extends from the anchor and shrinks back when the direction turns', () => {
    const { selection } = setup(3)

    selection.extend(1)
    selection.extend(1)
    expect(checked(selection)).toEqual([3, 4, 5])
    expect(selection.currentId.value).toBe(5)

    selection.extend(-1)
    expect(checked(selection)).toEqual([3, 4])

    selection.extend(-1)
    selection.extend(-1)
    expect(checked(selection)).toEqual([2, 3])
  })

  it('keeps the checked rows on a plain move and starts the next range at the cursor', () => {
    const { selection } = setup(1)

    selection.extend(1)
    selection.move(2)
    expect(checked(selection)).toEqual([1, 2])
    expect(selection.currentId.value).toBe(4)

    selection.extend(1)
    expect(checked(selection)).toEqual([1, 2, 4, 5])
  })

  it('extends to the ends and by pages', () => {
    const { selection } = setup(3)

    selection.extend('last')
    expect(checked(selection)).toEqual([3, 4, 5, 6])

    selection.extend('first')
    expect(checked(selection)).toEqual([1, 2, 3])

    selection.extend(2)
    expect(checked(selection)).toEqual([3])
  })

  it('ranges a click from the cursor, keeping rows toggled before', () => {
    const { selection } = setup(2)

    selection.extend(1)
    selection.move(2)
    selection.extendTo(6)
    expect(checked(selection)).toEqual([2, 3, 5, 6])

    selection.extendTo(3)
    expect(checked(selection)).toEqual([2, 3, 4, 5])
  })

  it('anchors at a row toggled away from the cursor until the cursor moves', () => {
    const { selection } = setup(1)

    selection.toggleChecked(3)
    selection.extendTo(5)
    expect(checked(selection)).toEqual([3, 4, 5])
    expect(selection.currentId.value).toBe(5)

    selection.toggleChecked(1)
    selection.move(-1)
    selection.extend(-1)
    expect(checked(selection)).toEqual([1, 3, 4, 5])
    expect(selection.currentId.value).toBe(3)
  })

  it('anchors at a row toggled under the cursor', () => {
    const { selection } = setup(4)

    selection.toggleChecked(4)
    selection.extend(-1)
    expect(checked(selection)).toEqual([3, 4])
  })

  it('checks every row and clears them again', () => {
    const { selection } = setup(2)

    selection.checkAll()
    expect(checked(selection)).toEqual([1, 2, 3, 4, 5, 6])

    selection.clearChecked()
    expect(checked(selection)).toEqual([])

    selection.extend(1)
    expect(checked(selection)).toEqual([2, 3])
  })

  it('unchecks rows that leave the list and restarts a range whose anchor left', async () => {
    const { ids, selection } = setup(2)

    selection.extend(1)
    ids.value = [1, 3, 4, 5, 6]
    await nextTick()
    expect(checked(selection)).toEqual([3])

    selection.extend(1)
    expect(checked(selection)).toEqual([3, 4])
  })
})
