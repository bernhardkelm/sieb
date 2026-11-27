<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import CalloutBox from '@/components/common/CalloutBox.vue'

defineEmits<{ acknowledge: [] }>()
</script>

<template>
  <CalloutBox tone="warning" class="conflict-notice" role="alert">
    <p class="text">
      The decisions changed while you reviewed this proposal. Check the current decisions, then
      review again to accept.
    </p>
    <template #actions>
      <BaseButton class="again" @click="$emit('acknowledge')">Review again</BaseButton>
    </template>
  </CalloutBox>
</template>

<style scoped>
.text {
  font-weight: var(--font-weight-medium);
}
</style>
