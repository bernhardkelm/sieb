import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Listens to keydown on the window while the calling component is mounted.
 * @param {(event: KeyboardEvent) => void} handler - Keydown handler
 * @returns {void}
 */
export const useWindowKeydown = (handler: (event: KeyboardEvent) => void): void => {
  onMounted(() => {
    window.addEventListener('keydown', handler)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handler)
  })
}
