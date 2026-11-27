<script setup lang="ts">
import type { CheckView } from '#core/check.ts'
import RecentCheckItem from '@/components/checks/RecentCheckItem.vue'

defineProps<{
  /** Finished and cancelled checks, newest first */
  checks: CheckView[]
}>()
</script>

<template>
  <section class="check-section" aria-labelledby="checks-recent">
    <h2 id="checks-recent" class="section-title">
      Recent <span class="count">{{ checks.length }}</span>
    </h2>
    <ol v-if="checks.length > 0" class="items">
      <RecentCheckItem v-for="check in checks" :key="check.id" :check="check" />
    </ol>
    <p v-else class="none">No finished checks yet.</p>
  </section>
</template>

<style scoped src="@/components/checks/checkSection.css"></style>
