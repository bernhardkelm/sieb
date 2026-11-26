import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

/** Time the item must have been on screen before the chord may run */
export const CHORD_ARM_DWELL_MS = 700

const CHORD_KEYS = new Set(['Enter', 'Meta', 'Control', 'Shift', 'Alt', 'AltGraph', 'OS'])

/**
 * Returns whether a key press is a deliberate interaction outside any accept chord: a fresh
 * press of a key other than Enter and the modifiers, with no modifier held.
 * @param {KeyboardEvent} event - Keydown event
 * @returns {boolean} - True when it may arm the chord
 */
const isArmingKey = (event: KeyboardEvent): boolean =>
  !event.repeat &&
  !CHORD_KEYS.has(event.key) &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey &&
  !event.shiftKey

/**
 * Arms a keyboard chord per shown item, such as Cmd+Enter accepting a proposal. It needs both:
 * CHORD_ARM_DWELL_MS since the item rendered, and after the render a pointer press inside the
 * element or a fresh press of a key that is no part of a chord (not Enter or a modifier, no
 * modifier held). A refused chord, a held key or keys pressed before the render never arm it,
 * so presses carried over from the previous item cannot land on the next one.
 * @param {Readonly<Ref<number | null>>} readyId - Id of the rendered item, null while none is shown
 * @param {Readonly<Ref<HTMLElement | null>>} element - Element whose pointer presses arm
 * @param {number} dwellMs - Time on screen the chord needs
 * @returns {() => boolean} - Returns whether the chord may run now
 */
export const useChordArming = (
  readyId: Readonly<Ref<number | null>>,
  element: Readonly<Ref<HTMLElement | null>>,
  dwellMs: number = CHORD_ARM_DWELL_MS,
): (() => boolean) => {
  let renderedAt: number | null = null
  let interacted = false

  watch(
    readyId,
    async (id) => {
      renderedAt = null
      interacted = false

      if (id === null) {
        return
      }

      await nextTick()

      if (readyId.value === id) {
        renderedAt = Date.now()
      }
    },
    { immediate: true },
  )

  /**
   * Arms on a deliberate key press after the render.
   * @param {KeyboardEvent} event - Keydown event
   * @returns {void}
   */
  const onKeydown = (event: KeyboardEvent): void => {
    if (renderedAt !== null && isArmingKey(event)) {
      interacted = true
    }
  }

  /**
   * Arms on a pointer press inside the element after the render.
   * @param {PointerEvent} event - Pointer press
   * @returns {void}
   */
  const onPointerdown = (event: PointerEvent): void => {
    if (
      renderedAt !== null &&
      event.target instanceof Node &&
      element.value?.contains(event.target) === true
    ) {
      interacted = true
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown, true)
    window.addEventListener('pointerdown', onPointerdown, true)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown, true)
    window.removeEventListener('pointerdown', onPointerdown, true)
  })

  return () => renderedAt !== null && interacted && Date.now() - renderedAt >= dwellMs
}
