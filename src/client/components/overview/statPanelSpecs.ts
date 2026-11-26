import type { OverviewStats } from '#core/overviewStats.ts'
import type { DeltaPolarity } from '@/components/overview/statDelta'
import { DECISION_TAB_QUERY, ROUTE_NAMES, type RouteName } from '@/router/routeNames'
import type { FindingFilters } from '@/stores/findingFilters'

export type StatPanelKey = 'open' | 'inbox' | 'kev' | 'public' | 'criticalHigh' | 'silenced'

/** View a panel opens; finding filters are reset first, then the given ones applied */
export interface StatTarget {
  route: RouteName
  query?: Record<string, string>
  filters?: Partial<FindingFilters>
  hint: string
}

export interface StatPanelSpec {
  key: StatPanelKey
  label: string
  value: (stats: OverviewStats) => number
  polarity: DeltaPolarity
  target: StatTarget | null
  primary: boolean // kept when the sidebar is short
  needsExposure?: true // shown only while some open finding has an exposure label
  needsKev?: true // shown only with a KEV source
}

export const STAT_PANEL_SPECS: StatPanelSpec[] = [
  {
    key: 'open',
    label: 'Open',
    value: (stats) => stats.open,
    polarity: 'fewer-is-better',
    target: { route: ROUTE_NAMES.IMAGES, hint: 'Open findings by image' },
    primary: true,
  },
  {
    key: 'inbox',
    label: 'Inbox',
    value: (stats) => stats.inbox,
    polarity: 'fewer-is-better',
    target: { route: ROUTE_NAMES.INBOX, filters: {}, hint: 'Untriaged findings in the inbox' },
    primary: true,
  },
  {
    key: 'kev',
    label: 'KEV',
    value: (stats) => stats.kev,
    polarity: 'fewer-is-better',
    target: null,
    primary: true,
    needsKev: true,
  },
  {
    key: 'criticalHigh',
    label: 'Crit + High',
    value: (stats) => stats.bySeverity.critical + stats.bySeverity.high,
    polarity: 'fewer-is-better',
    target: {
      route: ROUTE_NAMES.INBOX,
      filters: { severity: ['Critical', 'High'] },
      hint: 'Inbox filtered to critical and high',
    },
    primary: true,
  },
  {
    key: 'public',
    label: 'Public',
    value: (stats) => stats.public,
    polarity: 'fewer-is-better',
    target: {
      route: ROUTE_NAMES.INBOX,
      filters: { exposure: ['public'] },
      hint: 'Inbox filtered to public exposure',
    },
    primary: false,
    needsExposure: true,
  },
  {
    key: 'silenced',
    label: 'Silenced',
    value: (stats) => stats.suppressed,
    polarity: 'neutral',
    target: {
      route: ROUTE_NAMES.DECISIONS,
      query: { [DECISION_TAB_QUERY]: 'active' },
      hint: 'Active decisions',
    },
    primary: false,
  },
]
