<script setup lang="ts">
import type { CheckView } from '#core/check.ts'
import RecentCheckItem from '@/components/checks/RecentCheckItem.vue'
import SectionHeading from '@/components/common/SectionHeading.vue'

defineProps<{
  /** Finished and cancelled checks, newest first */
  checks: CheckView[]
}>()
</script>

<template>
  <section class="check-section" aria-labelledby="checks-recent">
    <SectionHeading id="checks-recent" :level="2" :count="checks.length">Recent</SectionHeading>
    <ol v-if="checks.length > 0" class="items">
      <RecentCheckItem v-for="check in checks" :key="check.id" :check="check" />
    </ol>
    <p v-else class="none">No finished checks yet.</p>
  </section>
</template>

<style scoped src="@/components/checks/checkSection.css"></style>
