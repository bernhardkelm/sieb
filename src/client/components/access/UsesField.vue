<script setup lang="ts">
import { computed, useId } from 'vue'

import { PROVIDER_SPECS, type AccessProvider, type AccessUse } from '#core/privateAccess.ts'
import FieldErrors from '@/components/decision/FieldErrors.vue'

const props = defineProps<{
  provider: AccessProvider
  uses: AccessUse[]
  registryHost: string
  gitHost: string
  errors: string[]
}>()

defineEmits<{ set: [use: AccessUse, on: boolean] }>()

const id = useId()
const options = computed(() =>
  PROVIDER_SPECS[props.provider].uses.map((use) =>
    use === 'registry'
      ? { use, label: 'Registry', hint: `pull images from ${props.registryHost || 'the registry'}` }
      : { use, label: 'Git', hint: `clone source from ${props.gitHost || 'the git host'}` },
  ),
)
</script>

<template>
  <fieldset
    class="uses-field"
    :aria-invalid="errors.length > 0 || undefined"
    :aria-describedby="errors.length > 0 ? `${id}-error` : undefined"
  >
    <legend class="label">Used for</legend>
    <label v-for="option in options" :key="option.use" class="check">
      <input
        type="checkbox"
        :checked="uses.includes(option.use)"
        :disabled="options.length === 1"
        @change="$emit('set', option.use, ($event.target as HTMLInputElement).checked)"
      />
      <span> <strong>{{ option.label }}</strong>, {{ option.hint }} </span>
    </label>
    <FieldErrors :id="`${id}-error`" :messages="errors" />
  </fieldset>
</template>

<style scoped>
.uses-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  border: 0;
}

.label {
  margin-bottom: var(--space-1);
  padding: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  min-height: var(--control-height);
}

.check input {
  margin: 0;
  accent-color: var(--color-accent);
}

.check strong {
  font-weight: var(--font-weight-medium);
}
</style>
