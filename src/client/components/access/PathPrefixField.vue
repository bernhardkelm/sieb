<script setup lang="ts">
import { computed } from 'vue'

import TextField from '@/components/common/TextField.vue'

const props = defineProps<{
  /** Hosts the credential serves, the first one names the example */
  hosts: string[]
  errors: string[]
}>()

const pathPrefix = defineModel<string>({ required: true })

const covered = computed(() => props.hosts.map((host) => `${host}/your-group/*`).join(' and '))
const whole = computed(() => (props.hosts.length > 1 ? 'the whole hosts' : 'the whole host'))
</script>

<template>
  <TextField
    v-model="pathPrefix"
    label="Path prefix"
    placeholder="your-group/"
    mono
    :errors="errors"
  >
    <template #hint>
      <code>your-group/</code> covers <code>{{ covered }}</code>; empty covers {{ whole }}. Matches
      whole path segments only.
    </template>
  </TextField>
</template>

<style scoped>
code {
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}
</style>
