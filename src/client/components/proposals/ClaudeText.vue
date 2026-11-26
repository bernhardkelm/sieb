<script setup lang="ts">
import { computed, ref, useId } from 'vue'

import { isLongText } from '@/components/proposals/proposalText'

const props = defineProps<{
  /** Claude-written plain text, never rendered as HTML */
  text: string
}>()

const id = useId()
const long = computed(() => isLongText(props.text))
const expanded = ref(false)
</script>

<template>
  <div class="claude-text">
    <p :id="id" class="text" :class="{ clamped: long && !expanded }">{{ text }}</p>
    <button
      v-if="long"
      type="button"
      class="toggle"
      :aria-expanded="expanded"
      :aria-controls="id"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Show less' : 'Show all' }}
    </button>
  </div>
</template>

<style scoped>
.claude-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

.text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.clamped {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 6;
  line-clamp: 6;
}

.toggle {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.toggle:hover {
  text-decoration: underline;
}

.toggle:focus-visible {
  outline: var(--border-width-strong) solid var(--color-focus);
  outline-offset: var(--border-width-strong);
  border-radius: var(--radius-sm);
}
</style>
