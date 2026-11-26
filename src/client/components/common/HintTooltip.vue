<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

import KeyHint from '@/components/common/KeyHint.vue'

withDefaults(
  defineProps<{
    text: string
    /** Shortcut keys shown next to the text */
    keys?: string[]
    side?: 'top' | 'right' | 'bottom' | 'left'
  }>(),
  { keys: () => [], side: 'bottom' },
)
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <!-- as-child renders the surface from this template, Reka moves class attrs off its scoped root -->
      <TooltipContent as-child :side="side" :side-offset="6" :collision-padding="8">
        <div class="hint-tooltip">
          {{ text }}
          <KeyHint v-if="keys.length > 0" :keys="keys" />
        </div>
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<style scoped>
.hint-tooltip {
  z-index: var(--z-tooltip);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  max-width: min(var(--tooltip-max-width), calc(100vw - 2 * var(--space-2)));
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
  white-space: pre-line;
}
</style>
