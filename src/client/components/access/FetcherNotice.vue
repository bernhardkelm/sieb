<script setup lang="ts">
import CalloutBox from '@/components/common/CalloutBox.vue'
</script>

<template>
  <CalloutBox as="p" tone="warning" role="note">
    The fetcher is not configured: Auto-check cannot use these credentials yet and still checks
    public images only. An operator sets <code>SIEB_FETCHER_SECRET</code> on sieb and the worker.
  </CalloutBox>
</template>

<style scoped>
code {
  font-family: var(--font-mono);
}
</style>
