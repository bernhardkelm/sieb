<script setup lang="ts">
import {
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from 'reka-ui'

import AppIcon from '@/components/icons/AppIcon.vue'
import { HANDOFF_OPTIONS, HANDOFF_PREFERENCES, isHandoffPreference } from '@/format/handoffTargets'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'

const targets = useHandoffTargetStore()

/**
 * Remembers the picked default action.
 * @param {unknown} value - Picked radio value
 * @returns {void}
 */
const onPick = (value: unknown): void => {
  if (isHandoffPreference(value)) {
    targets.setPreferred(value)
  }
}
</script>

<template>
  <DropdownMenuSub>
    <DropdownMenuSubTrigger class="item">
      <span class="text">
        <span>Default action</span>
        <span class="help">{{ HANDOFF_OPTIONS[targets.preferred].action }}, ⇧H</span>
      </span>
      <AppIcon class="icon" name="chevron-right" />
    </DropdownMenuSubTrigger>
    <DropdownMenuPortal>
      <DropdownMenuSubContent as-child :side-offset="4" :collision-padding="8">
        <div class="content" data-shortcut-scope="overlay">
          <DropdownMenuRadioGroup :model-value="targets.preferred" @update:model-value="onPick">
            <DropdownMenuRadioItem
              v-for="preference in HANDOFF_PREFERENCES"
              :key="preference"
              :value="preference"
              class="item"
            >
              <DropdownMenuItemIndicator class="check" force-mount>
                <AppIcon class="check-icon" name="check" />
              </DropdownMenuItemIndicator>
              {{ HANDOFF_OPTIONS[preference].label }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
</template>

<style scoped src="@/components/finding/handoffMenu.css"></style>

<style scoped>
.check {
  display: inline-grid;
  flex: none;
  width: var(--icon-size);
  height: var(--icon-size);
  visibility: hidden;
}

.check[data-state='checked'] {
  visibility: visible;
}

.check-icon {
  --icon-stroke: var(--icon-stroke-bold);

  color: var(--color-accent);
}
</style>
