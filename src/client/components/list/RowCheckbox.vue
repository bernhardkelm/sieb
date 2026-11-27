<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
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
    <AppIcon v-if="checked" class="check-icon" name="check" />
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

.check-icon {
  --icon-size: 100%;
  --icon-stroke: var(--icon-stroke-bold);

  display: block;
}
</style>
