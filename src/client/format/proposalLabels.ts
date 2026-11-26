import type {
  EvidenceBasis,
  ProposalConfidence,
  ProposalResolution,
  ProposalState,
  ProposalVerdict,
} from '#core/proposal.ts'
import type { SourceAccess } from '#core/sourceAccess.ts'

export const VERDICT_LABELS: Record<ProposalVerdict, string> = {
  not_affected: 'Not affected',
  accepted: 'Accepted',
  fix_planned: 'Fix planned',
  needs_patch: 'Needs patch',
}

export const CONFIDENCE_LABELS: Record<ProposalConfidence, string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
}

export const EVIDENCE_BASIS_LABELS: Record<EvidenceBasis, string> = {
  advisory: 'Advisory',
  upstream_source: 'Upstream source',
  image: 'Image',
  own_source: 'Own source',
  runtime: 'Runtime',
}

export const EVIDENCE_BASIS_HINTS: Record<EvidenceBasis, string> = {
  advisory: 'Read the advisory and the scanner data only',
  upstream_source: 'Checked the source code of the upstream project',
  image: 'Inspected the image contents',
  own_source: 'Checked the repository that builds this image',
  runtime: 'Checked the running workload',
}

export const PROPOSAL_STATE_LABELS: Record<ProposalState, string> = {
  open: 'Open',
  accepted: 'Accepted',
  rejected: 'Rejected',
  superseded: 'Superseded',
}

export const RESOLUTION_LABELS: Record<ProposalResolution, string> = {
  accepted: 'Accepted as proposed',
  accepted_edited: 'Accepted with edits',
  rejected: 'Rejected',
  replaced: 'Replaced by a newer proposal from the same proposer',
  other_accepted: 'Another proposal for this target was accepted',
  finding_resolved: 'The findings resolved',
}

export const SOURCE_ACCESS_LABELS: Record<SourceAccess, string> = {
  public: 'Public source',
  private: 'Private source',
  unknown: 'Source unknown',
}

export const SOURCE_ACCESS_HINTS: Record<SourceAccess, string> = {
  public:
    'Public image: Claude can read the upstream source and pull the published image to check the claim.',
  private:
    'Own image: Claude only sees the advisory, unless it runs in the repository that builds this image.',
  unknown:
    'Registry not listed as public: Claude can try to pull the image, its source may or may not be readable.',
}
