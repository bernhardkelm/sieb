<script setup lang="ts">
import ExpiryField from '@/components/decision/ExpiryField.vue'
import FieldErrors from '@/components/decision/FieldErrors.vue'

defineProps<{
  /** Id prefix of the form, the input and error ids derive from it */
  fieldId: string
  errors: string[]
}>()

const date = defineModel<string>('date', { required: true })
const never = defineModel<boolean>('never', { required: true })

defineEmits<{ touch: [] }>()
</script>

<template>
  <div class="field">
    <label :for="`${fieldId}-expiry`" class="label">Expires</label>
    <ExpiryField
      v-model:date="date"
      v-model:never="never"
      :input-id="`${fieldId}-expiry`"
      :error-id="`${fieldId}-expiry-error`"
      :invalid="errors.length > 0"
      @touch="$emit('touch')"
    />
    <FieldErrors :id="`${fieldId}-expiry-error`" :messages="errors" />
  </div>
</template>

<style scoped src="@/components/decision/decisionField.css"></style>
