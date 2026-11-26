<script setup lang="ts">
import { computed, ref, useId } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import CopyButton from '@/components/common/CopyButton.vue'
import { mcpAddCommand } from '@/components/tokens/mcpSetup'

const props = defineProps<{
  name: string
  secret: string
  /** Absolute URL of the MCP endpoint */
  mcpUrl: string
  /** Whether claude.ai connectors can sign in through OAuth */
  oauth: boolean
}>()

defineEmits<{ done: [] }>()

const root = ref<HTMLElement | null>(null)
const id = useId()

const command = computed(() => mcpAddCommand(props.mcpUrl, props.secret))

/**
 * Focuses the block, so screen readers start at the warning.
 * @returns {void}
 */
const focus = (): void => {
  root.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <section
    ref="root"
    class="new-token-secret"
    tabindex="-1"
    :aria-labelledby="`${id}-title`"
    :aria-describedby="`${id}-warning`"
  >
    <h3 :id="`${id}-title`" class="title">Token “{{ name }}” created</h3>
    <p :id="`${id}-warning`" class="warning">
      Copy the token now. sieb shows it only this once and cannot show it again.
    </p>
    <div class="copy-row">
      <code class="secret">{{ secret }}</code>
      <CopyButton :value="secret" label="Copy token" />
    </div>
    <h4 class="label">Claude Code</h4>
    <div class="copy-row">
      <code class="snippet">{{ command }}</code>
      <CopyButton :value="command" label="Copy Claude Code command" />
    </div>
    <p class="note">
      Claude Code stores the token in plain text in <code>~/.claude.json</code>. Never commit an
      <code>.mcp.json</code> that contains it.
    </p>
    <template v-if="oauth">
      <h4 class="label">claude.ai</h4>
      <div class="copy-row">
        <code class="snippet">{{ mcpUrl }}</code>
        <CopyButton :value="mcpUrl" label="Copy connector URL" />
      </div>
      <p class="note">Add as custom connector in claude.ai, sign in with your identity provider.</p>
    </template>
    <div class="actions">
      <BaseButton variant="primary" @click="$emit('done')">Done</BaseButton>
    </div>
  </section>
</template>

<style scoped>
.new-token-secret {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: var(--border-width) solid var(--color-warning);
  border-radius: var(--radius);
  background: var(--color-warning-wash);
}

.new-token-secret:focus-visible {
  outline: var(--border-width-strong) solid var(--color-focus);
  outline-offset: var(--border-width);
}

.title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  overflow-wrap: anywhere;
}

.warning {
  font-weight: var(--font-weight-medium);
}

.label {
  margin-top: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
}

.copy-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
}

.secret,
.snippet {
  flex: 1;
  min-width: 0;
  padding: var(--space-1-5) var(--space-2);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
  user-select: all;
}

.secret {
  font-weight: var(--font-weight-medium);
}

.note {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.note code {
  font-family: var(--font-mono);
}

.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
