<script setup lang="ts">
import { computed } from 'vue'

import type { DecisionScope } from '#core/decision.ts'
import RadioChoice from '@/components/decision/RadioChoice.vue'

const props = defineProps<{
  /** Short image name shown in the choice of this image */
  imageLabel: string
}>()

const scope = defineModel<DecisionScope>({ required: true })

const options = computed(() => [
  { value: 'image' as const, label: `Only ${props.imageLabel}` },
  { value: 'all' as const, label: 'All images' },
])
</script>

<template>
  <div class="field">
    <span class="label">Scope</span>
    <RadioChoice v-model="scope" label="Scope" :options="options" />
  </div>
</template>

<style scoped src="@/components/decision/decisionField.css"></style>
