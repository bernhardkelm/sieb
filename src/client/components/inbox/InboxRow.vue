<script setup lang="ts">
import { computed } from 'vue'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import { INBOX_KIND_TONES } from '@/components/chips/chipTones'
import KevChip from '@/components/chips/KevChip.vue'
import SeverityChip from '@/components/chips/SeverityChip.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import InboxItemDetail from '@/components/inbox/InboxItemDetail.vue'
import { isSeeable, isSelectable } from '@/components/inbox/inboxItems'
import ListRow from '@/components/list/ListRow.vue'
import RowCheckbox from '@/components/list/RowCheckbox.vue'
import { INBOX_KIND_LABELS, inboxScopeText } from '@/format/inboxText'

const props = defineProps<{
  item: InboxItem
  current: boolean
  checked: boolean
  /** Hides the KEV column, for the KEV source none */
  hideKev: boolean
}>()

defineEmits<{ select: [event: MouseEvent]; toggle: [event: MouseEvent]; seen: [] }>()

const seeable = computed(() => isSeeable(props.item))
const selectable = computed(() => isSelectable(props.item))
const scope = computed(() => inboxScopeText(props.item))
</script>

<template>
  <ListRow
    class="inbox-row"
    :class="{ 'no-kev': hideKev, selectable }"
    :current="current"
    :checked="checked"
    :data-inbox-key="item.key"
    @click="$emit('select', $event)"
  >
    <RowCheckbox v-if="selectable" :checked="checked" @toggle="$emit('toggle', $event)" />
    <span v-else class="no-check" aria-hidden="true" />
    <BaseChip class="kind" :tone="INBOX_KIND_TONES[item.kind]" variant="dot">{{
      INBOX_KIND_LABELS[item.kind]
    }}</BaseChip>
    <SeverityChip :severity="item.severity" :source="null" />
    <span v-if="!hideKev" class="kev"><KevChip v-if="item.kev" /></span>
    <span class="vuln-id">{{ item.vulnId }}</span>
    <HintTooltip :text="item.imageRef ?? scope">
      <span class="scope" :class="{ several: item.imageRef === null }">{{ scope }}</span>
    </HintTooltip>
    <InboxItemDetail class="detail" :item="item" />
    <span class="title" data-panel-clip>{{ item.title ?? '' }}</span>
    <span class="at"><RelativeTime :value="item.at" /></span>
    <span class="action">
      <button
        v-if="seeable"
        type="button"
        class="seen-button"
        tabindex="-1"
        title="Mark as seen (s)"
        @click.stop="$emit('seen')"
      >
        Seen
      </button>
    </span>
  </ListRow>
</template>

<style scoped src="@/components/inbox/inboxColumns.css"></style>
