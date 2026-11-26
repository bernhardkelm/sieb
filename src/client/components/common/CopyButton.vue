<script setup lang="ts">
import { useClipboardCopy } from '@/composables/useClipboardCopy'

const props = defineProps<{
  /** Text written to the clipboard */
  value: string
  /** Accessible name, such as "Copy CVE ID" */
  label: string
}>()

const { copied, copy } = useClipboardCopy()

/**
 * Copies the value to the clipboard, shows the check icon briefly, or raises an error toast.
 * @returns {Promise<void>}
 */
const onClick = async (): Promise<void> => {
  await copy(props.value)
}
</script>

<template>
  <button
    type="button"
    class="copy-button"
    :class="{ copied }"
    :aria-label="label"
    @click="onClick"
  >
    <svg class="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path v-if="copied" d="M3 8.5l3.5 3.5L13 4.5" />
      <template v-else>
        <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
        <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
      </template>
    </svg>
    <span class="status" role="status">{{ copied ? 'Copied' : '' }}</span>
  </button>
</template>

<style scoped>
.copy-button {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: var(--control-height);
  height: var(--control-height);
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
}

.copy-button:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.copy-button.copied {
  color: var(--color-success);
}

.icon {
  width: var(--icon-size);
  height: var(--icon-size);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

@media (hover: none) and (pointer: coarse), (max-width: 639px) {
  .copy-button {
    width: var(--touch-target);
    height: var(--touch-target);
  }
}
</style>
