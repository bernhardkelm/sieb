<script setup lang="ts">
import { ToastProvider, TooltipProvider } from 'reka-ui'
import { RouterView } from 'vue-router'

import AppToaster from '@/components/common/AppToaster.vue'
import AppShell from '@/components/layout/AppShell.vue'
import { toast } from '@/toast/toastManager'
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <ToastProvider :toast-manager="toast" :duration="4000" swipe-direction="right">
      <AppShell>
        <RouterView />
      </AppShell>
      <AppToaster />
    </ToastProvider>
  </TooltipProvider>
</template>
