<script setup lang="ts">
import { computed, ref } from 'vue'

import EmptyState from '@/components/common/EmptyState.vue'
import LoadState from '@/components/common/LoadState.vue'
import EditDecisionDialog from '@/components/decision/EditDecisionDialog.vue'
import RevokeDialog from '@/components/decision/RevokeDialog.vue'
import DecisionList from '@/components/decisions/DecisionList.vue'
import { DECISION_SORT_COLUMNS } from '@/components/decisions/decisionSort'
import DecisionTabs from '@/components/decisions/DecisionTabs.vue'
import { decisionTabEmpty } from '@/components/decisions/decisionTabs'
import SearchInput from '@/components/filters/SearchInput.vue'
import ViewToolbar from '@/components/layout/ViewToolbar.vue'
import ListSummary from '@/components/list/ListSummary.vue'
import SortMenu from '@/components/list/SortMenu.vue'
import { useDecisionsController } from '@/composables/useDecisionsController'
import { countOf } from '@/format/count'
import { scopeLabel } from '@/format/scopeLabel'
import { useDecisionsStore } from '@/stores/decisionsStore'
import { useFindingsStore } from '@/stores/findingsStore'
import { useLabelsStore } from '@/stores/labelsStore'

const store = useDecisionsStore()
const findings = useFindingsStore()
const labels = useLabelsStore()
const search = ref<InstanceType<typeof SearchInput> | null>(null)

const controller = useDecisionsController(() => search.value?.focus())
const { q, tab, counts, decisions, sort, expandedId, expandedFindings, currentKey } = controller
const { editOpen, editTarget, revokeOpen, revokeTarget, revoking, reconfirming } = controller

const empty = computed(() => decisionTabEmpty(tab.value, labels.showKev))
</script>

<template>
  <div class="decisions-view">
    <ViewToolbar>
      <SearchInput
        ref="search"
        v-model="q"
        class="search"
        placeholder="Search CVE, image, reason, author"
      />
      <SortMenu :columns="DECISION_SORT_COLUMNS" :sort="sort.sort.value" @change="sort.set" />
    </ViewToolbar>
    <LoadState
      v-if="!store.loaded || labels.pending"
      subject="decisions"
      :error="store.error"
      @retry="store.refresh()"
    />
    <EmptyState v-else-if="store.items.length === 0" title="No decisions yet">
      Decide findings in Triage; their decisions are listed here.
    </EmptyState>
    <DecisionTabs v-else v-model:tab="tab" :counts="counts">
      <ListSummary
        v-if="sort.label.value !== null && decisions.length > 0"
        :sort-label="sort.label.value"
        @reset-sort="controller.resetSort"
      >
        {{ countOf(decisions.length, 'decision') }}
      </ListSummary>
      <EmptyState v-if="decisions.length === 0" :title="empty.title">{{ empty.text }}</EmptyState>
      <DecisionList
        v-else
        :decisions="decisions"
        :expanded-id="expandedId"
        :current-key="currentKey"
        :findings="expandedFindings"
        :findings-loaded="findings.loaded"
        :reconfirming="reconfirming"
        :sort="sort.sort.value"
        @select="controller.select"
        @sort="sort.toggle"
        @reconfirm="controller.reconfirm"
        @edit="controller.edit"
        @revoke="controller.askRevoke"
        @open-finding="controller.openFirstFinding"
      />
    </DecisionTabs>
    <EditDecisionDialog v-model:open="editOpen" :view="editTarget" />
    <RevokeDialog
      v-model:open="revokeOpen"
      :vuln-id="revokeTarget?.decision.vulnId ?? ''"
      :target="revokeTarget ? scopeLabel(revokeTarget.decision) : undefined"
      :busy="revoking"
      @confirm="controller.confirmRevoke"
    />
  </div>
</template>

<style scoped>
@media (max-width: 639px) {
  .decisions-view .search {
    flex: 1 1 0;
  }
}
</style>
