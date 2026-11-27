<script setup lang="ts">
defineProps<{
  /** Claude's final reply, untrusted plain text */
  reply: string
}>()
</script>

<template>
  <details class="check-reply">
    <summary class="summary">Claude's reply</summary>
    <!-- text interpolation only, the reply is untrusted and never rendered as HTML -->
    <pre class="text">{{ reply }}</pre>
  </details>
</template>

<style scoped>
.check-reply {
  font-size: var(--font-size-sm);
}

.summary {
  width: fit-content;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
}

.summary:hover {
  color: var(--color-text);
}

.text {
  margin: var(--space-2) 0 0;
  padding: var(--space-2) var(--space-3);
  max-height: calc(var(--space-base) * 80);
  overflow: auto;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-page);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
