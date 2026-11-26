<script setup lang="ts">
import { useId } from 'vue'

import CopyButton from '@/components/common/CopyButton.vue'

defineProps<{
  /** Absolute URL of the MCP endpoint, entered as the connector URL in claude.ai */
  mcpUrl: string
}>()

const id = useId()
</script>

<template>
  <section class="connector-note" aria-label="Claude connector">
    <p>
      Claude apps and Claude Code connect through the sieb connector in claude.ai without a token.
      Tokens are for <code>claude -p</code>, CI and scripts.
    </p>
    <h3 :id="`${id}-label`" class="label">Connector URL</h3>
    <div class="copy-row" role="group" :aria-labelledby="`${id}-label`">
      <code class="snippet">{{ mcpUrl }}</code>
      <CopyButton :value="mcpUrl" label="Copy connector URL" />
    </div>
  </section>
</template>

<style scoped>
.connector-note {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-accent-wash);
  font-size: var(--font-size-sm);
}

.connector-note code {
  font-family: var(--font-mono);
}

.label {
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

.snippet {
  flex: 1;
  min-width: 0;
  padding: var(--space-1-5) var(--space-2);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  overflow-wrap: anywhere;
  user-select: all;
}
</style>
