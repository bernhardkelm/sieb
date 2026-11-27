<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import { ref } from 'vue'

import CloseButton from '@/components/common/CloseButton.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import SourceCodeLink from '@/components/layout/SourceCodeLink.vue'
import OverviewStats from '@/components/overview/OverviewStats.vue'

const open = ref(false)
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger class="overview-trigger" aria-label="Overview">
      <AppIcon class="icon" name="chart" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="overlay" />
      <DialogContent class="sheet">
        <DialogTitle class="visually-hidden">Overview</DialogTitle>
        <DialogDescription class="visually-hidden">
          Finding counts with their trend over the selected range
        </DialogDescription>
        <OverviewStats variant="sheet" @navigate="open = false">
          <template #actions>
            <DialogClose as-child>
              <CloseButton label="Close overview" />
            </DialogClose>
          </template>
        </OverviewStats>
        <SourceCodeLink class="source-code" />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.overview-trigger {
  display: none;
  place-items: center;
  width: var(--control-height);
  height: var(--control-height);
  padding: 0;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text-muted);
}

.overview-trigger:hover {
  color: var(--color-text);
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog);
  background: var(--color-backdrop);
}

.sheet {
  position: fixed;
  bottom: 0;
  left: 50%;
  z-index: var(--z-dialog);
  width: min(var(--dialog-width), 100vw);
  max-height: var(--sheet-max-height);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-3) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
  transform: translateX(-50%);
}

.source-code {
  margin-top: var(--space-4);
}

.sheet:focus-visible {
  outline: none;
}

/* matches the bottom navigation breakpoint of AppShell, the sidebar shows the overview above it */
@media (max-width: 899px) {
  .overview-trigger {
    display: inline-grid;
  }
}

@media (max-width: 639px) {
  .overview-trigger {
    width: var(--touch-target);
    height: var(--touch-target);
  }
}
</style>
