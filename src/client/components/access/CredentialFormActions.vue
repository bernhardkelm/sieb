<script setup lang="ts">
import { computed } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'

const props = defineProps<{
  editing: boolean
  /** Whether saving runs the credential test first */
  tested: boolean
  /** Whether a save or test is in flight */
  busy: boolean
}>()

defineEmits<{ cancel: []; test: [] }>()

const saveLabel = computed(() => {
  if (!props.editing) {
    return 'Test and save'
  }

  return props.tested ? 'Test and save changes' : 'Save changes'
})
</script>

<template>
  <div class="credential-form-actions">
    <BaseButton @click="$emit('cancel')">Cancel</BaseButton>
    <BaseButton :disabled="busy" @click="$emit('test')">Test only</BaseButton>
    <BaseButton type="submit" variant="primary" :disabled="busy">{{ saveLabel }}</BaseButton>
  </div>
</template>

<style scoped>
.credential-form-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
