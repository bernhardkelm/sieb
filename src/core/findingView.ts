import type { Decision } from '#core/decision.ts'
import type { DecisionEvent } from '#core/decisionEvent.ts'
import type { EffectiveDecision } from '#core/effectiveDecision.ts'
import type { Finding } from '#core/finding.ts'
import type { FindingInstance } from '#core/instance.ts'
import type { KevDetails } from '#core/kev.ts'

/** Finding with counts over its current instances, the last sighting for resolved findings */
export interface FindingSummary extends Finding {
  instanceCount: number
  workloadCount: number
  namespaces: string[]
  workloads: string[] // "namespace/kind/name"
  packages: string[]
  fixable: boolean // a current instance has a fixed version
}

/** Finding with its governing decision as the list views need it */
export interface FindingView extends FindingSummary {
  decision: Decision | null
  effective: EffectiveDecision | null
  inInbox: boolean
  seen?: boolean // acting user saw it, set by GET /api/findings, true only within the recent window
}

/** Decision with its state and the number of open findings it governs */
export interface DecisionView {
  decision: Decision
  effective: EffectiveDecision
  openFindings: number
}

/** Everything the finding side panel shows */
export interface FindingDetail {
  finding: FindingView
  instances: FindingInstance[] // resolved ones included, open first
  decisions: DecisionView[] // every decision covering the finding, revoked ones included, newest first
  events: DecisionEvent[] // history of those decisions, oldest first
  kev: KevDetails | null // CISA catalog entry of a KEV listed finding, null for other KEV sources
}
