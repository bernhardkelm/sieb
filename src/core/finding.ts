import type { Exposure } from '#core/exposure.ts'
import type { Severity } from '#core/severity.ts'

/** Finding-level fields derived from the instances of one vuln_id x image_ref */
export interface FindingFields {
  severity: Severity
  score: number | null
  severitySource: string | null // "cvss" when the cluster re-rated the vendor severity
  kev: boolean
  exposure: Exposure | null // null without an exposure label
  owner: string | null // free-form, null without an owner label
  title: string | null
  primaryLink: string | null
}

export interface FindingKey {
  vulnId: string
  imageRef: string // registry + "/" + repository, no tag
}

/** Decision unit: one vulnerability in one image, aggregating its instances */
export interface Finding extends FindingKey, FindingFields {
  id: number
  firstSeen: string
  lastSeen: string
  resolvedAt: string | null
}
