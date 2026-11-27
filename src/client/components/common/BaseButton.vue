<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'secondary' | 'primary' | 'danger' | 'ghost'
    /** md is the control height, touch the touch target height for bars on phones */
    size?: 'md' | 'touch'
    type?: 'button' | 'submit'
    disabled?: boolean
  }>(),
  { variant: 'secondary', size: 'md', type: 'button', disabled: false },
)
</script>

<template>
  <button :type="type" class="base-button" :class="[variant, size]" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  height: var(--control-height);
  padding: 0 var(--space-3);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  transition: background-color var(--duration-fast) var(--ease);
}

.base-button:hover:not(:disabled, [aria-disabled='true']) {
  background: var(--color-hover);
}

.base-button:disabled {
  color: var(--color-text-subtle);
}

.base-button[aria-disabled='true'] {
  cursor: default;
  opacity: var(--opacity-disabled);
}

.touch {
  min-width: var(--touch-target);
  height: auto;
  min-height: var(--touch-target);
}

.primary {
  border-color: transparent;
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.primary:hover:not(:disabled, [aria-disabled='true']) {
  background: color-mix(in srgb, var(--color-accent) 88%, var(--ink));
}

.primary:disabled {
  background: color-mix(in srgb, var(--color-accent) 55%, var(--paper));
  color: var(--color-on-accent);
}

.danger {
  border-color: transparent;
  background: var(--color-danger);
  color: var(--paper);
}

.danger:hover:not(:disabled, [aria-disabled='true']) {
  background: color-mix(in srgb, var(--color-danger) 88%, var(--ink));
}

.ghost {
  height: auto;
  padding: var(--space-0-5) var(--space-1-5);
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.ghost:hover:not(:disabled, [aria-disabled='true']) {
  color: var(--color-text);
}

@media (hover: none) and (pointer: coarse) {
  .ghost {
    min-height: var(--control-height);
  }
}
</style>
