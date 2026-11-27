<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import type { IconName } from '@/components/icons/iconPaths'
import type { ThemeChoice } from '@/composables/useTheme'

defineProps<{
  choice: ThemeChoice
}>()

const ICONS: Record<ThemeChoice, IconName> = {
  light: 'sun',
  dark: 'moon',
  auto: 'monitor',
}
</script>

<template>
  <AppIcon class="theme-icon" :name="ICONS[choice]" />
</template>
