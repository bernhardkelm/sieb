<script setup lang="ts">
import { computed } from 'vue'

import type { KevFeedStatus } from '#core/kev.ts'
import type { ChipTone } from '@/components/chips/chipTone'
import BaseButton from '@/components/common/BaseButton.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import StatusDot from '@/components/common/StatusDot.vue'
import { useNow } from '@/composables/useNow'
import { describeKevFeed, isKevFeedStale } from '@/format/kevFeedText'
import { formatAbsolute, formatRelative } from '@/format/relativeTime'

const props = withDefaults(
  defineProps<{
    /** ISO timestamp of the last finished sync, null before the first one */
    lastSyncAt: string | null
    /** Outcome of the last sync, null before the first one */
    ok: boolean | null
    syncing: boolean
    /** Error of the last failed sync, shown in the tooltip */
    error?: string | null
    /** Why the sync status could not be fetched, null while the server answers */
    fetchError?: string | null
    /** Health of the CISA KEV catalog, a stale one marks the status dot, null for other KEV sources */
    kevFeed?: KevFeedStatus | null
  }>(),
  { error: null, fetchError: null, kevFeed: null },
)

defineEmits<{ sync: [] }>()

const now = useNow()

const status = computed(() => {
  if (props.syncing) {
    return 'Syncing…'
  }

  if (props.fetchError !== null) {
    return 'Sync status unavailable'
  }

  if (props.lastSyncAt === null) {
    return 'Not synced yet'
  }

  const time = formatRelative(props.lastSyncAt, now.value)

  return props.ok ? `Synced ${time}` : `Sync failed ${time}`
})

const failed = computed(() => props.fetchError !== null || props.ok === false)
const kevStale = computed(() => isKevFeedStale(props.kevFeed))

/**
 * Picks the status dot colour: a failure wins over a stale KEV catalog, which wins over success.
 * @returns {ChipTone} - Dot tone
 */
const dotToneOf = (): ChipTone => {
  if (failed.value) {
    return 'danger'
  }

  if (kevStale.value) {
    return 'warning'
  }

  return props.ok === true ? 'success' : 'neutral'
}

const dotTone = computed(dotToneOf)

/**
 * Describes the last sync for the tooltip.
 * @returns {string} - One line
 */
const syncDetail = (): string => {
  if (props.fetchError !== null) {
    const last = props.lastSyncAt ? `, last known sync ${formatAbsolute(props.lastSyncAt)}` : ''

    return `Sync status unavailable: ${props.fetchError}${last}`
  }

  if (props.lastSyncAt === null) {
    return 'No sync has finished yet'
  }

  const time = formatAbsolute(props.lastSyncAt)

  return props.ok ? `Last sync ${time}` : `Failed ${time}: ${props.error ?? 'unknown error'}`
}

const detail = computed(() =>
  [syncDetail(), describeKevFeed(props.kevFeed)].filter((line) => line !== null).join('\n'),
)
</script>

<template>
  <div class="sync-control">
    <HintTooltip :text="detail">
      <span class="status" :class="{ failed: failed && !syncing }" role="status" tabindex="0">
        <LoadingSpinner v-if="syncing" />
        <StatusDot v-else class="dot" :tone="dotTone" />
        <span class="text">{{ status }}</span>
      </span>
    </HintTooltip>
    <HintTooltip text="Pull findings from the source now" :keys="['r']">
      <BaseButton :disabled="syncing" aria-keyshortcuts="r" @click="$emit('sync')">Sync</BaseButton>
    </HintTooltip>
  </div>
</template>

<style scoped>
.sync-control {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.status.failed {
  color: var(--color-danger);
}

@media (max-width: 639px) {
  .sync-control {
    gap: var(--space-2);
  }

  .status {
    justify-content: center;
    min-width: var(--control-height);
    min-height: var(--control-height);
  }

  .text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
