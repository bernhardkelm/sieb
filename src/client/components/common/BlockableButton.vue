<script setup lang="ts">
import { useId, type Component } from 'vue'

import { runUnlessBlocked } from '@/toast/blockedNotice'

const props = withDefaults(
  defineProps<{
    /** Why the action cannot run now, null while it can */
    blockedBy: string | null
    /** Toast title naming the reason when a blocked button is pressed */
    blockedTitle: string
    /** Native tooltip while the action can run */
    hint?: string
    /** Leaves out the native tooltip and the reason text, for a caller whose HintTooltip shows both */
    untitled?: boolean
    /** Marks a request in flight, the button stays focusable and ignores presses */
    busy?: boolean
    /** Element or component that renders the button, such as BaseButton */
    as?: Component | 'button'
  }>(),
  { hint: undefined, untitled: false, busy: false, as: 'button' },
)

const emit = defineEmits<{ press: [] }>()

const reasonId = useId()

/**
 * Emits the press, or names the reason in a toast while blocked, since a tap shows no tooltip.
 * A busy button ignores the press.
 * @returns {void}
 */
const onClick = (): void => {
  if (props.busy) {
    return
  }

  runUnlessBlocked(props.blockedBy, props.blockedTitle, () => emit('press'))
}
</script>

<template>
  <component
    :is="as"
    type="button"
    :aria-disabled="blockedBy !== null || busy || undefined"
    :aria-busy="busy || undefined"
    :aria-describedby="blockedBy !== null && !untitled ? reasonId : undefined"
    :title="untitled ? undefined : (blockedBy ?? hint)"
    @click="onClick"
  >
    <slot />
    <span v-if="blockedBy !== null && !untitled" :id="reasonId" hidden>{{ blockedBy }}</span>
  </component>
</template>
