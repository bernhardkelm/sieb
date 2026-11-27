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
import AppIcon from '@/components/icons/AppIcon.vue'
import KeyHint from '@/components/common/KeyHint.vue'
import HandoffDefaultMenu from '@/components/finding/HandoffDefaultMenu.vue'
import { HANDOFF_OPTIONS } from '@/format/handoffTargets'
import { HANDOFF_KEYS } from '@/keyboard/handoffKeymap'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { useMcpStore } from '@/stores/mcpStore'

defineProps<{
  /** claude command for own images, null leaves its entry out */
  command: string | null
}>()

const emit = defineEmits<{ open: [target: HandoffTarget]; copy: [kind: 'prompt' | 'command'] }>()

const targets = useHandoffTargetStore()
const mcp = useMcpStore()
const helpId = useId()
const noteId = `${helpId}-connect`

/**
 * Returns the description ids of an item, the connect note first while Claude cannot reach sieb.
 * @param {string | null} help - Id of the item's own help line
 * @returns {string | undefined} - Space separated ids, undefined without any
 */
const describedBy = (help: string | null): string | undefined =>
  [mcp.connectReason === null ? null : noteId, help].filter((id) => id !== null).join(' ') ||
  undefined
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="chevron" aria-label="More ways to hand off to Claude">
      <AppIcon class="icon" name="chevron-down" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <!-- as-child renders the surface from this template, Reka moves class attrs off its scoped root -->
      <DropdownMenuContent as-child align="end" :side-offset="4" :collision-padding="8">
        <!-- overlay scope keeps Escape and list keys away from the panel and the page -->
        <div class="content" data-shortcut-scope="overlay" :aria-describedby="describedBy(null)">
          <p v-if="mcp.connectReason !== null" :id="noteId" class="note">
            {{ mcp.connectReason }}
          </p>
          <DropdownMenuLabel class="heading caps-label"
            >Open in, prompt prefilled</DropdownMenuLabel
          >
          <DropdownMenuItem
            v-for="target in HANDOFF_TARGETS"
            :key="target"
            class="item"
            :disabled="mcp.connectReason !== null"
            :title="mcp.connectReason ?? undefined"
            :aria-describedby="describedBy(`${helpId}-${target}`)"
            :aria-keyshortcuts="
              targets.preferred === target ? HANDOFF_KEYS.open.shortcut : undefined
            "
            @select="emit('open', target)"
          >
            <span class="text">
              <span>{{ HANDOFF_OPTIONS[target].label }}</span>
              <span :id="`${helpId}-${target}`" class="help">{{
                HANDOFF_OPTIONS[target].help
              }}</span>
            </span>
            <KeyHint
              v-if="targets.preferred === target"
              decorative
              :keys="HANDOFF_KEYS.open.hintKeys"
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator class="separator" />
          <DropdownMenuLabel class="heading caps-label">Copy</DropdownMenuLabel>
          <DropdownMenuItem
            class="item"
            :aria-keyshortcuts="HANDOFF_KEYS.prompt.shortcut"
            @select="emit('copy', 'prompt')"
          >
            <span class="text">Copy prompt</span>
            <KeyHint decorative :keys="HANDOFF_KEYS.prompt.hintKeys" />
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="command !== null"
            class="item"
            :disabled="mcp.connectReason !== null"
            :title="mcp.connectReason ?? undefined"
            :aria-describedby="describedBy(null)"
            :aria-keyshortcuts="HANDOFF_KEYS.command.shortcut"
            @select="emit('copy', 'command')"
          >
            <span class="text">Copy claude command</span>
            <KeyHint decorative :keys="HANDOFF_KEYS.command.hintKeys" />
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
  width: var(--segment-height, var(--control-height));
  height: var(--segment-height, var(--control-height));
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
    width: var(--segment-height, var(--touch-target));
    height: var(--segment-height, var(--touch-target));
  }
}
</style>
