<script setup lang="ts">
defineProps<{
  checked: boolean
}>()

defineEmits<{ toggle: [event: MouseEvent] }>()
</script>

<template>
  <span
    class="row-checkbox"
    :class="{ checked }"
    aria-hidden="true"
    @click.stop="$emit('toggle', $event)"
  >
    <svg v-if="checked" viewBox="0 0 16 16" focusable="false">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  </span>
</template>

<style scoped>
.row-checkbox {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: var(--checkbox-size);
  height: var(--checkbox-size);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  cursor: pointer;
  opacity: 0.5;
}

.row-checkbox:hover,
.checked {
  opacity: 1;
}

.checked {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-on-accent);
}

@media (hover: none) and (pointer: coarse) {
  .row-checkbox {
    opacity: 1;
  }

  .row-checkbox::after {
    content: '';
    position: absolute;
    inset: calc((var(--checkbox-size) - var(--touch-target)) / 2);
  }
}

svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
