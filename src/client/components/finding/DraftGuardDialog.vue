<script setup lang="ts">
import { watch } from 'vue'

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { useDraftGuard } from '@/composables/useDraftGuard'

const props = defineProps<{
  /** Whether the decision form holds input that leaving the finding would discard */
  dirty: boolean
}>()

const emit = defineEmits<{ keep: [] }>()

const { asking, discard, keep } = useDraftGuard(() => props.dirty)
let kept = false
let returnTo: Element | null = null

/**
 * Treats closing the dialog by Escape or the cancel button as keeping the draft.
 * @param {boolean} open - Next open state
 * @returns {void}
 */
const onOpenChange = (open: boolean): void => {
  if (!open) {
    kept = true
    keep()
  }
}

/**
 * Discards the draft and lets the navigation proceed.
 * @returns {void}
 */
const onDiscard = (): void => {
  kept = false
  discard()
}

/**
 * Moves focus back to the form after keeping the draft, otherwise to the element focused when
 * the question came up, such as the clicked row; the navigation then moves focus on its own.
 * @param {Event} event - Close auto focus event of the dialog
 * @returns {void}
 */
const onCloseAutoFocus = (event: Event): void => {
  event.preventDefault()

  if (kept) {
    emit('keep')
  } else if (returnTo instanceof HTMLElement && returnTo.isConnected) {
    returnTo.focus({ preventScroll: true })
  }

  kept = false
  returnTo = null
}

watch(asking, (value) => {
  if (value) {
    returnTo = document.activeElement
  }
})
</script>

<template>
  <ConfirmDialog
    :open="asking"
    title="Discard the unsaved decision?"
    description="The status, reason and expiry you entered for this finding are lost."
    confirm-label="Discard"
    cancel-label="Keep editing"
    @update:open="onOpenChange"
    @confirm="onDiscard"
    @close-auto-focus="onCloseAutoFocus"
  />
</template>
