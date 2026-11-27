<script setup lang="ts">
import { ref } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import KeyHint from '@/components/common/KeyHint.vue'

withDefaults(
  defineProps<{
    placeholder?: string
    /** Accessible name of the input, the placeholder when omitted */
    label?: string
  }>(),
  { placeholder: 'Search' },
)

const model = defineModel<string>({ required: true })

const input = ref<HTMLInputElement | null>(null)

/**
 * Focuses the input and selects its text.
 * @returns {void}
 */
const focus = (): void => {
  input.value?.focus()
  input.value?.select()
}

/**
 * Clears the search on Escape, or leaves the input when it is empty already.
 * @param {KeyboardEvent} event - Keydown event
 * @returns {void}
 */
const onEscape = (event: KeyboardEvent): void => {
  event.preventDefault()

  if (model.value === '') {
    input.value?.blur()
  } else {
    model.value = ''
  }
}

defineExpose({ focus })
</script>

<template>
  <label class="search-input">
    <span class="visually-hidden">{{ label ?? placeholder }}</span>
    <AppIcon class="icon" name="search" />
    <input
      ref="input"
      v-model="model"
      type="search"
      name="q"
      :placeholder="placeholder"
      aria-keyshortcuts="/"
      @keydown.escape="onEscape"
    />
    <KeyHint v-if="model === ''" class="hint" decorative :keys="['/']" />
  </label>
</template>

<style scoped>
.search-input {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  width: var(--search-width);
  max-width: 100%;
  height: var(--control-height);
  padding: 0 var(--space-2);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.search-input:focus-within {
  border-color: var(--color-focus);
}

.icon {
  color: var(--color-text-subtle);
}

input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  outline: none;
}

input::placeholder {
  color: var(--color-text-subtle);
}

.hint {
  flex: none;
}

@media (max-width: 639px) {
  .search-input {
    flex: 1 1 100%;
    width: 100%;
  }
}
</style>
