import type { FindingDetail } from '#core/findingView.ts'
import type { KevSourceKind } from '#core/kev.ts'
import type { ImageCheckAccess } from '#core/privateAccess.ts'
import type { SourceAccess } from '#core/sourceAccess.ts'

/** Optional finding labels present on open findings and the KEV source, absent ones are hidden in the UI */
export interface LabelsResponse {
  exposure: boolean // some open finding has an exposure label
  owners: string[] // distinct owner labels of open findings, self first, then alphabetical
  kev: KevSourceKind // none hides every KEV element
}

/** Body of POST /api/findings/seen */
export interface FindingsSeenRequest {
  ids: number[]
}

/** Answer of POST /api/findings/seen */
export interface FindingsSeenResponse {
  ignored: number[] // valid ids of unknown findings or ones outside the recent window, not marked
}

/** Answer of GET /api/findings/:id: the side panel detail with the source access of the image */
export interface FindingDetailResponse extends FindingDetail {
  sourceAccess: SourceAccess
  checkAccess?: ImageCheckAccess[] // how Auto-check reaches the finding's image, the server always sets it
}
