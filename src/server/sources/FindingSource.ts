import type { SourceSnapshot } from '#core/sourceSnapshot.ts'
import type { SourceKind } from '#core/types.ts'

/** Provider of normalised finding snapshots, one implementation per SIEB_SOURCE */
export interface FindingSource {
  kind: SourceKind
  fetchSnapshot: () => Promise<SourceSnapshot> // rejects when any part of the source fails
}
