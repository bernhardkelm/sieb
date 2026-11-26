<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { useId } from 'vue'

import { HANDOFF_TARGETS, type HandoffTarget } from '#core/handoffLinks.ts'
import KeyHint from '@/components/common/KeyHint.vue'
import HandoffDefaultMenu from '@/components/finding/HandoffDefaultMenu.vue'
import { HANDOFF_OPTIONS } from '@/format/handoffTargets'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'

defineProps<{
  /** claude command for own images, null leaves its entry out */
  command: string | null
}>()

const emit = defineEmits<{ open: [target: HandoffTarget]; copy: [kind: 'prompt' | 'command'] }>()

const targets = useHandoffTargetStore()
const helpId = useId()
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="chevron" aria-label="More ways to hand off to Claude">
      <svg class="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M4.5 6.5 8 10l3.5-3.5" />
      </svg>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <!-- as-child renders the surface from this template, Reka moves class attrs off its scoped root -->
      <DropdownMenuContent as-child align="end" :side-offset="4" :collision-padding="8">
        <!-- overlay scope keeps Escape and list keys away from the panel and the page -->
        <div class="content" data-shortcut-scope="overlay">
          <DropdownMenuLabel class="heading">Open in, prompt prefilled</DropdownMenuLabel>
          <DropdownMenuItem
            v-for="target in HANDOFF_TARGETS"
            :key="target"
            class="item"
            :aria-describedby="`${helpId}-${target}`"
            @select="emit('open', target)"
          >
            <span class="text">
              <span>{{ HANDOFF_OPTIONS[target].label }}</span>
              <span :id="`${helpId}-${target}`" class="help">{{
                HANDOFF_OPTIONS[target].help
              }}</span>
            </span>
            <KeyHint v-if="targets.preferred === target" :keys="['⇧', 'H']" />
          </DropdownMenuItem>
          <DropdownMenuSeparator class="separator" />
          <DropdownMenuLabel class="heading">Copy</DropdownMenuLabel>
          <DropdownMenuItem class="item" @select="emit('copy', 'prompt')">
            <span class="text">Copy prompt</span>
            <KeyHint :keys="['h']" />
          </DropdownMenuItem>
          <DropdownMenuItem v-if="command !== null" class="item" @select="emit('copy', 'command')">
            <span class="text">Copy claude command</span>
            <KeyHint :keys="['y']" />
          </DropdownMenuItem>
          <DropdownMenuSeparator class="separator" />
          <HandoffDefaultMenu />
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style scoped src="@/components/finding/handoffMenu.css"></style>

<style scoped>
.chevron {
  display: inline-grid;
  place-items: center;
  width: var(--control-height);
  height: var(--control-height);
  padding: 0;
  border: 0;
  border-left: var(--border-width) solid var(--color-border);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: transparent;
  color: var(--color-text-muted);
}

.chevron:hover,
.chevron[aria-expanded='true'] {
  background: var(--color-hover);
  color: var(--color-text);
}

@media (hover: none) and (pointer: coarse), (max-width: 639px) {
  .chevron {
    width: var(--touch-target);
    height: var(--touch-target);
  }
}
</style>
