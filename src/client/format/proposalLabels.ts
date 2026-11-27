import type {
  EvidenceBasis,
  PatchLayer,
  ProposalConfidence,
  ProposalResolution,
  ProposalState,
  ProposalVerdict,
} from '#core/proposal.ts'
import { STATUS_LABELS } from '@/format/labels'

export const VERDICT_LABELS: Record<ProposalVerdict, string> = {
  ...STATUS_LABELS,
  needs_patch: 'Needs patch',
  inconclusive: 'Could not determine',
}

export const PATCH_LAYER_LABELS: Record<PatchLayer, string> = {
  dependency: 'Dependency',
  base_image: 'Base image',
  image: 'Image',
  platform: 'Platform',
  unknown: 'Layer unknown',
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
