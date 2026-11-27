<script setup lang="ts">
import type { Component } from 'vue'

import BlockableButton from '@/components/common/BlockableButton.vue'
import { useSelectionAutoCheck } from '@/composables/useSelectionAutoCheck'
import { useChecksStore } from '@/stores/checksStore'

withDefaults(
  defineProps<{
    /** Element or component that renders the button, such as BaseButton */
    as?: Component | 'button'
  }>(),
  { as: 'button' },
)

const checks = useChecksStore()
const autoCheck = useSelectionAutoCheck()
</script>

<template>
  <BlockableButton
    v-if="checks.enabled"
    :as="as"
    :blocked-by="autoCheck.blockedBy.value"
    blocked-title="No Auto-check queued"
    hint="Queue an Auto-check per selected finding"
    @press="autoCheck.run()"
  >
    <slot>Auto-check</slot>
  </BlockableButton>
</template>
