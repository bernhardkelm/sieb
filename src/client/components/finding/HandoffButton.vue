<script setup lang="ts">
import { computed } from 'vue'

import type { HandoffTarget } from '#core/handoffLinks.ts'
import type { HandoffPrompts } from '#core/handoffPrompt.ts'
import HandoffMenu from '@/components/finding/HandoffMenu.vue'
import { usePanelAction } from '@/components/finding/panelAction'
import { useClipboardCopy } from '@/composables/useClipboardCopy'
import { useConnectionPoll } from '@/composables/useConnectionPoll'
import { useHandoffOpen } from '@/composables/useHandoffOpen'
import { HANDOFF_OPTIONS } from '@/format/handoffTargets'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { useMcpStore } from '@/stores/mcpStore'

const props = defineProps<{
  /** Prompts per client kind that hand the finding over to Claude, chat is the copied one */
  prompts: HandoffPrompts
  /** claude command for own images, null leaves the command out of the menu */
  command: string | null
}>()

const targets = useHandoffTargetStore()
const mcp = useMcpStore()
const { copied, copy } = useClipboardCopy()
const { open } = useHandoffOpen()
const panelAction = usePanelAction()

const label = computed(() => HANDOFF_OPTIONS[targets.preferred].action)

const primaryBlockedBy = computed(() => (targets.preferred === 'copy' ? null : mcp.connectReason))

useConnectionPoll(() => targets.preferred !== 'copy')

/**
 * Runs the default action: copies the prompt with the check icon as feedback, or opens the
 * default client unless Claude cannot reach sieb yet.
 * @returns {void}
 */
const runPrimary = (): void => {
  if (primaryBlockedBy.value !== null) {
    return
  }

  panelAction()

  if (targets.preferred === 'copy') {
    void copy(props.prompts.chat)
    return
  }

  open(targets.preferred, props.prompts)
}

/**
 * Opens a client picked in the menu.
 * @param {HandoffTarget} target - Client
 * @returns {void}
 */
const openTarget = (target: HandoffTarget): void => {
  panelAction()
  open(target, props.prompts)
}

/**
 * Copies the prompt or the claude command picked in the menu, the primary button shows the
 * check icon briefly.
 * @param {'prompt' | 'command'} kind - Text to copy
 * @returns {void}
 */
const copyText = (kind: 'prompt' | 'command'): void => {
  const text = kind === 'command' ? props.command : props.prompts.chat

  if (text !== null) {
    panelAction()
    void copy(text)
  }
}
</script>

<template>
  <span class="handoff-button" role="group" aria-label="Hand off to Claude">
    <button
      type="button"
      class="primary"
      :class="{ copied }"
      :aria-disabled="primaryBlockedBy !== null || undefined"
      :tabindex="primaryBlockedBy !== null ? -1 : undefined"
      :title="primaryBlockedBy ?? `${label} (Shift+H)`"
      aria-keyshortcuts="Shift+H"
      @click="runPrimary"
    >
      <svg class="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path v-if="copied" d="M3 8.5l3.5 3.5L13 4.5" />
        <path
          v-else
          d="M8 2c.5 3.4 2.6 5.5 6 6-3.4.5-5.5 2.6-6 6-.5-3.4-2.6-5.5-6-6 3.4-.5 5.5-2.6 6-6z"
        />
      </svg>
      <span class="label">{{ label }}</span>
    </button>
    <HandoffMenu :command="command" @open="openTarget" @copy="copyText" />
    <span class="visually-hidden" role="status">{{ copied ? 'Copied' : '' }}</span>
  </span>
</template>

<style scoped>
.handoff-button {
  display: inline-flex;
  flex: none;
  align-items: center;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
}

.primary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: var(--control-height);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.primary:hover:not([aria-disabled='true']) {
  background: var(--color-hover);
  color: var(--color-text);
}

.primary[aria-disabled='true'] {
  cursor: default;
  opacity: 0.55;
}

.primary.copied {
  color: var(--color-success);
}

.icon {
  flex: none;
  width: var(--icon-size);
  height: var(--icon-size);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (hover: none) and (pointer: coarse), (max-width: 639px) {
  .primary {
    justify-content: center;
    min-width: var(--touch-target);
    height: var(--touch-target);
  }
}

/* icon only on narrow screens, the label stays the accessible name */
@media (max-width: 639px) {
  .label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
