<script setup lang="ts">
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'

import BaseButton from '@/components/common/BaseButton.vue'

withDefaults(
  defineProps<{
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    /** Disables the buttons while the confirmed action runs */
    busy?: boolean
  }>(),
  { confirmLabel: 'Confirm', cancelLabel: 'Cancel', busy: false },
)

const open = defineModel<boolean>('open', { required: true })

defineEmits<{ confirm: []; closeAutoFocus: [event: Event] }>()
</script>

<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay class="overlay" />
      <AlertDialogContent class="content" @close-auto-focus="$emit('closeAutoFocus', $event)">
        <AlertDialogTitle class="title">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription class="description">{{ description }}</AlertDialogDescription>
        <slot />
        <div class="actions">
          <AlertDialogCancel as-child>
            <BaseButton :disabled="busy">{{ cancelLabel }}</BaseButton>
          </AlertDialogCancel>
          <BaseButton variant="danger" :disabled="busy" @click="$emit('confirm')">
            {{ confirmLabel }}
          </BaseButton>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style scoped src="@/components/common/dialogSurface.css"></style>

<style scoped>
.content {
  --dialog-offset: var(--dialog-top-alert);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
