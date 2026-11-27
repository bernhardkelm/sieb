<script setup lang="ts">
import type { AccessUse } from '#core/privateAccess.ts'
import TextField from '@/components/common/TextField.vue'

defineProps<{
  uses: AccessUse[]
  registryErrors: string[]
  gitErrors: string[]
}>()

const registryHost = defineModel<string>('registryHost', { required: true })
const gitHost = defineModel<string>('gitHost', { required: true })
</script>

<template>
  <div class="host-fields">
    <TextField
      v-if="uses.includes('registry')"
      v-model="registryHost"
      label="Registry host"
      placeholder="registry.gitlab.example.com"
      hint="Keep registry.gitlab.com for gitlab.com, set your own for a self-hosted GitLab."
      mono
      required
      :errors="registryErrors"
    />
    <TextField
      v-if="uses.includes('git')"
      v-model="gitHost"
      label="Git host"
      placeholder="gitlab.example.com"
      mono
      required
      :errors="gitErrors"
    />
  </div>
</template>

<style scoped>
.host-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
