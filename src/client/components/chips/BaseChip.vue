<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import type { ChipTone, ChipVariant } from '@/components/chips/chipTone'
import StatusDot from '@/components/common/StatusDot.vue'

const props = withDefaults(
  defineProps<{
    tone?: ChipTone
    /**
     * wash tints the background, outline draws a neutral border, dot puts a coloured dot before
     * the label, framed adds a tinted border to the wash, pending a dashed one for content
     * Claude wrote or that waits on Claude
     */
    variant?: ChipVariant
    /** Large for a header verdict, wraps instead of truncating */
    size?: 'sm' | 'lg'
    /** Renders the chip as a link that shows a solid border on hover */
    to?: RouteLocationRaw | null
    /** Makes a plain chip a tab stop that opens its tooltip on focus, never inside a list row */
    focusable?: boolean
  }>(),
  { tone: 'neutral', variant: 'wash', size: 'sm', to: null, focusable: false },
)

const tag = computed(() => (props.to === null ? 'span' : RouterLink))
const bound = computed(() => ({
  ...(props.to === null ? {} : { to: props.to }),
  tabindex: props.focusable && props.to === null ? 0 : undefined,
}))
</script>

<template>
  <component
    :is="tag"
    class="chip"
    :class="[tone, variant, size, { link: to !== null }]"
    v-bind="bound"
  >
    <StatusDot v-if="variant === 'dot'" :tone="tone" />
    <slot />
  </component>
</template>

<style scoped>
.chip {
  --tone-color: var(--color-text-muted);
  --tone-wash: var(--color-severity-unknown-wash);
  --tone-ink: var(--tone-color);

  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-1);
  height: var(--chip-height);
  padding: 0 var(--space-1-5);
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-sm);
  background: var(--tone-wash);
  color: var(--tone-ink);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
}

.lg {
  height: auto;
  max-width: 100%;
  padding: var(--space-1-5) var(--space-3);
  border-radius: var(--radius);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  white-space: normal;
  overflow-wrap: anywhere;
}

.outline {
  border-color: var(--color-border);
  background: transparent;
}

.dot {
  background: transparent;
  color: var(--color-text);
}

.framed {
  border-color: color-mix(in srgb, var(--tone-color) var(--chip-border-mix), transparent);
}

.pending {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--tone-color) var(--chip-border-mix), transparent);
}

.link {
  cursor: pointer;
}

.link:hover {
  border-style: solid;
  border-color: var(--tone-color);
}
</style>

<style scoped src="@/components/chips/toneColors.css"></style>
