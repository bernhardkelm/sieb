import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'

export interface ConfirmAction<T> {
  /** Target the open confirmation asks about, null before the first ask */
  target: Readonly<ShallowRef<T | null>>
  /** Whether the confirmation dialog is open */
  open: Ref<boolean>
  /** Whether the action runs */
  busy: Readonly<Ref<boolean>>
  /** Failure of the last confirmed run, reset by the next ask */
  error: Readonly<ShallowRef<unknown>>
  /** Opens the confirmation for a target */
  ask: (target: T) => void
  /** Runs the action on the asked target, closes the dialog on success and keeps it open on failure */
  confirm: () => Promise<boolean>
  /** Runs the action at once, without asking, one run at a time */
  run: (target: T) => Promise<boolean>
}

/**
 * Holds the state of an action that a confirmation dialog guards: the asked target, the open
 * dialog, the running request and its failure.
 * @param {(target: T) => Promise<void>} action - Action, rejects with the failure
 * @returns {ConfirmAction<T>} - Dialog state, ask, confirm and an unasked run
 */
export const useConfirmAction = <T extends object>(
  action: (target: T) => Promise<void>,
): ConfirmAction<T> => {
  const target: ShallowRef<T | null> = shallowRef(null)
  const open = ref(false)
  const busy = ref(false)
  const error = shallowRef<unknown>(null)

  /**
   * Runs the action unless a run is in flight, recording a failure.
   * @param {T} value - Target
   * @returns {Promise<boolean>} - Whether the action succeeded
   */
  const run = async (value: T): Promise<boolean> => {
    if (busy.value) {
      return false
    }

    busy.value = true

    try {
      await action(value)
      return true
    } catch (failure) {
      error.value = failure
      return false
    } finally {
      busy.value = false
    }
  }

  /**
   * Opens the confirmation for a target.
   * @param {T} value - Target
   * @returns {void}
   */
  const ask = (value: T): void => {
    target.value = value
    error.value = null
    open.value = true
  }

  /**
   * Runs the action on the asked target and closes the dialog once it succeeded.
   * @returns {Promise<boolean>} - Whether the action succeeded
   */
  const confirm = async (): Promise<boolean> => {
    const value = target.value

    if (value === null) {
      return false
    }

    const done = await run(value)

    if (done) {
      open.value = false
    }

    return done
  }

  return { target, open, busy, error, ask, confirm, run }
}
