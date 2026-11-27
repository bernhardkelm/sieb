<script setup lang="ts">
import { computed, type Component } from 'vue'

import BlockableButton from '@/components/common/BlockableButton.vue'
import { bulkLabel, type BulkCount, type BulkNoun } from '@/format/bulkCount'

const props = withDefaults(
  defineProps<{
    /** Action label without the count, such as "Accept" */
    label: string
    /** Label with `{n}` where the count goes, the count follows the label when absent */
    template?: string
    count: BulkCount
    noun: BulkNoun
    /** Why the action cannot run now, null while it can */
    blockedBy: string | null
    /** Toast title naming the reason when a blocked button is pressed */
    blockedTitle: string
    /** Native tooltip while the action acts on every checked item */
    hint?: string
    /** Element or component that renders the button, such as BaseButton */
    as?: Component | 'button'
  }>(),
  { template: undefined, hint: undefined, as: 'button' },
)

defineEmits<{ press: [] }>()

const labels = computed(() => bulkLabel(props.label, props.count, props.noun, props.template))
</script>

<template>
  <BlockableButton
    :as="as"
    :blocked-by="blockedBy"
    :blocked-title="blockedTitle"
    :hint="labels.partial ?? hint"
    :aria-label="labels.ariaLabel"
    @press="$emit('press')"
  >
    {{ labels.text }}
  </BlockableButton>
</template>
