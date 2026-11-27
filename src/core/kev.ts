import { DAY_MS } from '#core/timeUnits.ts'
/** Where the KEV listing comes from, SIEB_KEV_SOURCE */
export type KevSourceKind = 'cisa' | 'prometheus' | 'none'

export const KEV_SOURCES: readonly KevSourceKind[] = ['cisa', 'prometheus', 'none']

/** One entry of the CISA Known Exploited Vulnerabilities catalog */
export interface KevEntry {
  cveId: string
  vendorProject: string | null
  product: string | null
  vulnerabilityName: string | null
  dateAdded: string // YYYY-MM-DD
  shortDescription: string | null
  requiredAction: string | null
  dueDate: string | null // YYYY-MM-DD
  knownRansomware: boolean | null // knownRansomwareCampaignUse, null when neither Known nor Unknown
  notes: string | null
}

/** KEV catalog details of a finding, as the finding panel shows them */
export type KevDetails = Omit<KevEntry, 'cveId'>

/** Health of the stored CISA KEV catalog */
export interface KevFeedStatus {
  lastAttemptAt: string | null
  lastSuccessAt: string | null // null until a fetch succeeded once
  lastError: string | null // error of the latest attempt, null when it succeeded
  catalogVersion: string | null
  entryCount: number
  stale: boolean // no successful fetch yet, or the last one is older than KEV_STALE_AFTER_MS
}

export const KEV_REFRESH_AFTER_MS = DAY_MS
export const KEV_STALE_AFTER_MS = 2 * KEV_REFRESH_AFTER_MS
