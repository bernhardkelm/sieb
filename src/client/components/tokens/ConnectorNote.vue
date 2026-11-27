<script setup lang="ts">
import { useId } from 'vue'

import CalloutBox from '@/components/common/CalloutBox.vue'
import CopyField from '@/components/common/CopyField.vue'

defineProps<{
  /** Absolute URL of the MCP endpoint, entered as the connector URL in claude.ai */
  mcpUrl: string
}>()

const id = useId()
</script>

<template>
  <CalloutBox as="section" class="connector-note" aria-label="Claude connector">
    <p>
      Claude apps and Claude Code connect through the sieb connector in claude.ai without a token.
      Tokens are for <code>claude -p</code>, CI and scripts.
    </p>
    <h3 :id="`${id}-label`" class="caps-label">Connector URL</h3>
    <CopyField
      role="group"
      :aria-labelledby="`${id}-label`"
      :value="mcpUrl"
      label="Copy connector URL"
    />
  </CalloutBox>
</template>

<style scoped>
code {
  font-family: var(--font-mono);
}
</style>
