<script setup lang="ts">
import BaseChip from '@/components/chips/BaseChip.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
</script>

<template>
  <HintTooltip text="Listed in the CISA Known Exploited Vulnerabilities catalog">
    <BaseChip tone="kev">KEV</BaseChip>
  </HintTooltip>
</template>
