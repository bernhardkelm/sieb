<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { computed, ref } from 'vue'

import { logout } from '@/api/authApi'
import AppIcon from '@/components/icons/AppIcon.vue'
import ApiTokensDialog from '@/components/tokens/ApiTokensDialog.vue'
import { useMcpStore } from '@/stores/mcpStore'
import { useMeStore } from '@/stores/meStore'
import { notifyError } from '@/toast/toastManager'

const me = useMeStore()
const mcp = useMcpStore()

const tokensOpen = ref(false)

const hasTokens = computed(() => mcp.enabled)
const hasLogout = computed(() => me.authMode === 'oidc')
const hasMenu = computed(() => hasTokens.value || hasLogout.value)

/**
 * Ends the session and navigates to the address the server returns.
 * @returns {Promise<void>}
 */
const onLogout = async (): Promise<void> => {
  try {
    window.location.assign(await logout())
  } catch (error) {
    notifyError('Could not log out', error)
  }
}
</script>

<template>
  <template v-if="me.username">
    <DropdownMenuRoot v-if="hasMenu">
      <DropdownMenuTrigger class="trigger">
        <AppIcon class="icon" name="user" />
        <span class="visually-hidden">User menu of </span>
        <span class="name">{{ me.username }}</span>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <!-- as-child renders the surface from this template, Reka moves class attrs off its scoped root -->
        <DropdownMenuContent as-child align="end" :side-offset="4" :collision-padding="8">
          <div class="content">
            <DropdownMenuItem v-if="hasTokens" class="item" @select="tokensOpen = true">
              API tokens…
            </DropdownMenuItem>
            <DropdownMenuItem v-if="hasLogout" class="item" @select="onLogout">
              Log out
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
    <span v-else class="user">{{ me.username }}</span>
  </template>
  <ApiTokensDialog v-if="hasTokens" v-model:open="tokensOpen" />
</template>

<style scoped>
.trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: var(--control-height);
  padding: 0 var(--space-1-5);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.trigger:hover,
.trigger[aria-expanded='true'] {
  background: var(--color-hover);
  color: var(--color-text);
}

.user {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.content {
  z-index: var(--z-menu);
  display: flex;
  flex-direction: column;
  min-width: var(--popover-min-width);
  max-width: calc(100vw - 2 * var(--space-2));
  padding: var(--space-1);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
  color: var(--color-text);
}

.item {
  display: flex;
  align-items: center;
  min-height: var(--touch-target);
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  outline: none;
  cursor: pointer;
}

.item[data-highlighted] {
  background: var(--color-hover);
}

@media (max-width: 639px) {
  .trigger {
    justify-content: center;
    width: var(--touch-target);
    height: var(--touch-target);
    padding: 0;
  }

  .user {
    display: none;
  }

  /* icon only, the name stays in the accessible name */
  .trigger .name {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
