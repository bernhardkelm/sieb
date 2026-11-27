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
    /** Element or component that renders the button, such as BaseButton */
    as?: Component | 'button'
  }>(),
  { hint: undefined, as: 'button' },
)

const emit = defineEmits<{ press: [] }>()

const reasonId = useId()

/**
 * Emits the press, or names the reason in a toast while blocked, since a tap shows no tooltip.
 * @returns {void}
 */
const onClick = (): void => {
  runUnlessBlocked(props.blockedBy, props.blockedTitle, () => emit('press'))
}
</script>

<template>
  <component
    :is="as"
    type="button"
    :aria-disabled="blockedBy !== null || undefined"
    :aria-describedby="blockedBy !== null ? reasonId : undefined"
    :title="blockedBy ?? hint"
    @click="onClick"
  >
    <slot />
    <span v-if="blockedBy !== null" :id="reasonId" hidden>{{ blockedBy }}</span>
  </component>
</template>
