<script setup lang="ts">
import IconButton from '@/components/common/IconButton.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { usePanelAutoCheck } from '@/composables/usePanelAutoCheck'
import { AUTO_CHECK_SHORTCUT } from '@/keyboard/handoffKeymap'
import { useChecksStore } from '@/stores/checksStore'

const checks = useChecksStore()
const { blockedBy, submitting, run } = usePanelAutoCheck()
</script>

<template>
  <IconButton
    v-if="checks.enabled"
    class="auto-check-button"
    label="Auto-check"
    hint="Queue a headless Claude check of this finding, it files a proposal"
    :keys="[AUTO_CHECK_SHORTCUT]"
    :blocked-by="blockedBy"
    blocked-title="No Auto-check queued"
    :busy="submitting"
    :aria-keyshortcuts="AUTO_CHECK_SHORTCUT"
    @press="run()"
  >
    <AppIcon name="auto-check" />
  </IconButton>
</template>
