<script setup lang="ts">
import { computed } from 'vue'

import type { HandoffTarget } from '#core/handoffLinks.ts'
import type { HandoffPrompts } from '#core/handoffPrompt.ts'
import BlockableButton from '@/components/common/BlockableButton.vue'
import HandoffMenu from '@/components/finding/HandoffMenu.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { usePanelAction } from '@/components/finding/panelAction'
import { useClipboardCopy } from '@/composables/useClipboardCopy'
import { useConnectionPoll } from '@/composables/useConnectionPoll'
import { useHandoffOpen } from '@/composables/useHandoffOpen'
import { HANDOFF_OPTIONS, openBlockReason } from '@/format/handoffTargets'
import { HANDOFF_KEYS } from '@/keyboard/handoffKeymap'
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

const primaryBlockedBy = computed(() => openBlockReason(targets.preferred, mcp.connectReason))

const OPEN_SHORTCUT = HANDOFF_KEYS.open.shortcut

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
    <BlockableButton
      class="primary"
      :class="{ copied }"
      :blocked-by="primaryBlockedBy"
      blocked-title="Not handed off"
      :hint="`${label} (${OPEN_SHORTCUT})`"
      :aria-keyshortcuts="OPEN_SHORTCUT"
      @press="runPrimary"
    >
      <AppIcon :name="copied ? 'check' : 'sparkle'" />
      <span class="label">{{ label }}</span>
    </BlockableButton>
    <HandoffMenu :command="command" @open="openTarget" @copy="copyText" />
    <span class="visually-hidden" role="status">{{ copied ? 'Copied' : '' }}</span>
  </span>
</template>

<style scoped src="@/components/finding/handoffButton.css"></style>
