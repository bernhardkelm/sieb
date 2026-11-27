<script setup lang="ts">
import CalloutBox from '@/components/common/CalloutBox.vue'
</script>

<template>
  <CalloutBox as="p" tone="warning">
    During an Auto-check, Claude reads the private images and the source code these credentials
    reach, and what it reads is sent to Anthropic. Only add credentials for code your organisation
    allows to share with Claude.
  </CalloutBox>
</template>
