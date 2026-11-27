<script setup lang="ts">
import { computed, ref, useId } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import CalloutBox from '@/components/common/CalloutBox.vue'
import CopyField from '@/components/common/CopyField.vue'
import { mcpAddCommand } from '@/components/tokens/mcpSetup'

const props = defineProps<{
  name: string
  secret: string
  /** Absolute URL of the MCP endpoint */
  mcpUrl: string
}>()

defineEmits<{ done: [] }>()

const root = ref<InstanceType<typeof CalloutBox> | null>(null)
const id = useId()

const command = computed(() => mcpAddCommand(props.mcpUrl, props.secret))

/**
 * Focuses the block, so screen readers start at the warning.
 * @returns {void}
 */
const focus = (): void => {
  const element = root.value?.$el as HTMLElement | undefined

  element?.focus()
}

defineExpose({ focus })
</script>

<template>
  <CalloutBox
    ref="root"
    as="section"
    tone="warning"
    class="new-token-secret"
    tabindex="-1"
    :aria-labelledby="`${id}-title`"
    :aria-describedby="`${id}-warning`"
  >
    <h3 :id="`${id}-title`" class="title">Token “{{ name }}” created</h3>
    <p :id="`${id}-warning`" class="warning">
      Copy the token now. sieb shows it only this once and cannot show it again.
    </p>
    <CopyField :value="secret" label="Copy token" emphasis />
    <h4 class="label caps-label">Claude Code with this token</h4>
    <CopyField :value="command" label="Copy Claude Code command" />
    <p class="note">
      Claude Code stores the token in plain text in <code>~/.claude.json</code>. Never commit an
      <code>.mcp.json</code> that contains it.
    </p>
    <template #actions>
      <BaseButton variant="primary" @click="$emit('done')">Done</BaseButton>
    </template>
  </CalloutBox>
</template>

<style scoped>
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
}

.note {
  color: var(--color-text-muted);
}

.note code {
  font-family: var(--font-mono);
}
</style>
