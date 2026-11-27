import type { WorkerClaim, WorkerClaimImage } from '#core/check.ts'
import { SOURCE_SKIP_REASONS, type CheckedSource } from '#core/privateAccess.ts'
import type { CheckLayout } from '#checker/workspace/checkLayout.ts'
import type { WorkspaceImages } from '#checker/workspace/prepareWorkspace.ts'
import type { PulledImage } from '#checker/workspace/resolveImage.ts'
import type { ToolContext } from '#checker/workspace/runTool.ts'

/** Why the workspace holds no source/: sieb's skip reasons and the fetcher's own */
export const SOURCE_MISS_REASONS = [
  ...SOURCE_SKIP_REASONS,
  'clone_failed',
  'too_large',
  'unavailable', // sieb's source endpoint did not answer
  'no_fetcher', // single-container mode
] as const

export type SourceMissReason = (typeof SOURCE_MISS_REASONS)[number]

/** The source checkout of the primary image, or why there is none */
export type SourceOutcome = { checked: CheckedSource } | { missing: SourceMissReason }

/** POST /prepare body of the fetcher's local endpoint */
export interface PrepareRequest {
  checkId: number
  images: WorkerClaimImage[] // the claim's images, primary first
  timeoutMs: number // time left until the check deadline
}

/** POST /prepare answer with status 200: the filled workspace */
export interface PrepareAnswer {
  images: WorkspaceImages
  source: SourceOutcome
}

/** POST /prepare answer with status 422: the check fails with this reason */
export interface PrepareError {
  error: string // short reason, no secrets
  pulled: PulledImage[] // the resolved primary image when known, for the pulled note
}

/** POST /release body: the checker is done with the workspace of a check */
export interface ReleaseRequest {
  checkId: number
}

/** A prepared workspace as runCheck sees it */
export interface PreparedCheck {
  images: WorkspaceImages
  source: SourceOutcome
}

/** Fills the workspace of a check, locally or through the fetcher */
export interface WorkspacePreparer {
  prepare: (
    claim: WorkerClaim,
    layout: CheckLayout,
    context: ToolContext,
    onPulled: (images: PulledImage[]) => void, // called with the primary image once it is exported
  ) => Promise<PreparedCheck>
  release: (checkId: number) => Promise<void> // removes the workspace, never throws
}
