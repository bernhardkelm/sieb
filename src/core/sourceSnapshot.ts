import type { FindingKey } from '#core/finding.ts'
import type { InstanceDetails, InstanceWorkload } from '#core/instance.ts'
import type { Exposure } from '#core/exposure.ts'
import type { Severity } from '#core/severity.ts'

/** Normalised source row: a Prometheus info series joined with one report vulnerability */
export interface SourceInstance extends FindingKey, InstanceWorkload, InstanceDetails {
  severity: Severity
  score: number | null
  severitySource: string | null
  exposure: Exposure | null
  owner: string | null
  title: string | null
  primaryLink: string | null
}

/** Everything one source fetch returns */
export interface SourceSnapshot {
  instances: SourceInstance[]
  kevIds: string[] | null // vuln ids on the CISA KEV list, null while unknown keeps the stored flags
  fetchedAt: string
}
