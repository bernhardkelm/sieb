<script setup lang="ts">
import { computed, useId } from 'vue'

import { PROVIDER_SPECS, type AccessProvider, type AccessUse } from '#core/privateAccess.ts'
import DockerHubInstructions from '@/components/access/DockerHubInstructions.vue'
import GithubInstructions from '@/components/access/GithubInstructions.vue'
import GitlabInstructions from '@/components/access/GitlabInstructions.vue'

const props = defineProps<{
  provider: AccessProvider
  uses: AccessUse[]
}>()

const id = useId()
const title = computed(() => `${PROVIDER_SPECS[props.provider].label} token with the least access`)
</script>

<template>
  <section class="provider-instructions" :aria-labelledby="id">
    <h3 :id="id" class="heading">{{ title }}</h3>
    <GithubInstructions v-if="provider === 'github'" :uses="uses" />
    <GitlabInstructions v-else-if="provider === 'gitlab'" />
    <DockerHubInstructions v-else />
  </section>
</template>

<style scoped>
.provider-instructions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-sidebar);
  font-size: var(--font-size-sm);
}

.heading {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}
</style>
