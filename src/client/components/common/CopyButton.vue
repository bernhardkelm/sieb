<script setup lang="ts">
import IconButton from '@/components/common/IconButton.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { usePanelAction } from '@/components/finding/panelAction'
import { useClipboardCopy } from '@/composables/useClipboardCopy'

const props = defineProps<{
  /** Text written to the clipboard */
  value: string
  /** Accessible name, such as "Copy CVE ID" */
  label: string
}>()

const { copied, copy } = useClipboardCopy()
const panelAction = usePanelAction()

/**
 * Copies the value to the clipboard, shows the check icon briefly, or raises an error toast.
 * Inside the finding side panel a copy counts as an action on its finding.
 * @returns {Promise<void>}
 */
const onClick = async (): Promise<void> => {
  if (await copy(props.value)) {
    panelAction()
  }
}
</script>

<template>
  <IconButton class="copy-button" :label="label" :bordered="false" @press="onClick">
    <AppIcon :class="{ copied }" :name="copied ? 'check' : 'copy'" />
    <span class="visually-hidden" role="status">{{ copied ? 'Copied' : '' }}</span>
  </IconButton>
</template>

<style scoped>
.copied {
  color: var(--color-success);
}
</style>
