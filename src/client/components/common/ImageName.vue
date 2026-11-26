<script setup lang="ts">
import { computed } from 'vue'

import HintTooltip from '@/components/common/HintTooltip.vue'
import { shortImageName } from '@/format/imageName'

const props = defineProps<{
  imageRef: string
}>()

const name = computed(() => shortImageName(props.imageRef))
</script>

<template>
  <HintTooltip :text="imageRef">
    <span class="image-name">{{ name }}</span>
  </HintTooltip>
</template>

<style scoped>
.image-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
