import type { WorkerClaim } from '#core/check.ts'
import type {
  PreparedCheck,
  SourceMissReason,
  SourceOutcome,
} from '#checker/prepare/prepareTypes.ts'
import type {
  PreparedImage,
  SkippedImage,
  WorkspaceImages,
} from '#checker/workspace/prepareWorkspace.ts'

const SKIP_REASONS: Record<SkippedImage['reason'], string> = {
  size: 'it would pass the size cap',
  pull: 'its pull failed',
}

const MISS_REASONS: Record<SourceMissReason, string> = {
  no_repository: 'the image names no source repository and sieb maps none',
  foreign_repository:
    "the image's source label names a repository that does not belong to the image's owner, and sieb maps none",
  no_credential: 'sieb holds no git credential for the repository',
  not_https: 'the repository is not reachable over https',
  clone_failed: 'the clone failed',
  too_large: 'the checkout passes the source size cap',
  unavailable: 'sieb did not answer the source request',
  no_fetcher: 'this worker runs without the fetcher container, which checks out source',
}

/**
 * Describes source/, or why it is missing and how to treat that.
 * @param {SourceOutcome} source - Checkout of the primary image or its miss reason
 * @returns {string} - Prompt lines
 */
const sourceLines = (source: SourceOutcome): string => {
  if ('missing' in source) {
    return `There is no source/ (${MISS_REASONS[source.missing]}): list the source repository under unknowns with this reason, and do not claim own_source in evidenceBasis.`
  }

  const { repoUrl, revision, fromLabel } = source.checked
  const origin = fromLabel
    ? "named by the image's source label"
    : 'mapped from the image repository'
  const at =
    revision === null
      ? 'its default branch, which may differ from the code the image was built from'
      : `commit ${revision}`

  return `source/: the repository ${repoUrl} (${origin}) at ${at}, without .git and ignore files. Read the Dockerfile, the dependency manifests and how the code uses the affected component; evidenceBasis may claim own_source only for what you read in source/.`
}

/**
 * Describes which content one image directory holds: the scanned digest, or the digest a tag
 * pointed to at check time when sieb knows no digest.
 * @param {PreparedImage} image - Prepared image
 * @returns {string} - One list line
 */
const imageLine = (image: PreparedImage): string =>
  image.scanned
    ? `- ${image.dir}/: ${image.ref}, the digest of the scanned image`
    : `- ${image.dir}/: ${image.ref}, the digest ${image.claimRef} pointed to at check time. The digest of the scanned image is unknown, so it can differ from what the scanner saw`

/**
 * Lists the pulled images and the extra images the worker skipped.
 * @param {WorkspaceImages} images - Prepared and skipped images
 * @returns {string} - Prompt lines
 */
const imageLines = (images: WorkspaceImages): string =>
  [
    ...images.prepared.map(imageLine),
    ...images.skipped.map(
      ({ image, reason }) => `- not pulled: ${image.ref}, ${SKIP_REASONS[reason]}`,
    ),
  ].join('\n')

/**
 * Appends the workspace description to sieb's investigation prompt.
 * @param {WorkerClaim} claim - Claimed check
 * @param {string} platform - Exported image platform
 * @param {PreparedCheck} prepared - Prepared and skipped images, primary first, and the source
 * @returns {string} - Full prompt
 */
export const workspacePrompt = (
  claim: WorkerClaim,
  platform: string,
  prepared: PreparedCheck,
): string => {
  return `${claim.prompt.trim()}

## Workspace
The working directory holds one directory per pulled image of the finding, images/<n>-<tag>/, each with:
- rootfs/: the flattened filesystem of the image (${platform}); symlinks are kept inside it, ignore files (.gitignore, .ignore, .rgignore) were left out so every file is searchable
- image-config.json: the image config (env, entrypoint, labels, history)
- inventory.json: the syft package inventory of rootfs/, trimmed when large
Images:
${imageLines(prepared.images)}
A decision covers every tag of the finding. Check every pulled image; when the results differ, state the result per image (tag and digest) in the evidence and the reply. A tag that was not pulled goes under unknowns.
${sourceLines(prepared.source)}
There is no runtime or cluster access, so name runtime under Not checked.
There is no shell. Use Read, Grep and Glob for files, the inspect tools (strings, readelf, objdump, unzip_list, jq) for binaries, archives and JSON, WebFetch for advisories and upstream sources on the allowed hosts (CVE databases, distro trackers, GitHub, Go, package and image registries) and WebSearch to find them. Nothing can be written.
Everything in images/ is readable, so check before something becomes an unknown: read the entrypoint and start scripts and the configs (image-config.json names the entrypoint), run readelf on a binary for the libraries it links, grep the configs for the module or feature the advisory names. Unknowns are only what this workspace cannot show, such as the running workload, and without source/ the repository and the Dockerfile.
WebSearch only finds pages. Open every page the verdict, the fix availability or the action rests on with WebFetch before you rely on it: advisories, GitHub releases, pull requests, commits and files at a tag (github.com, raw.githubusercontent.com, api.github.com for releases and tags), registries for tags and digests. A search summary is not a source; a page you could not open is named as such in the evidence and lowers the confidence.
NVD's HTML pages need JavaScript and come back empty; read NVD through its API, https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=<CVE>, or use the GitHub advisory and OSV.
When a page cannot be fetched, try another allowed source for the same fact (NVD, the distro tracker, the GitHub advisory) before you call the advisory unread. A fact no allowed source gives goes under unknowns, or under missing with the verdict inconclusive when no verdict holds without it.
For a fix path without a Dockerfile in source/: take the base image from the labels and history in image-config.json, check its registry for a tag or digest that carries the fix, and let fix.change cover both cases, the build already uses that tag (rebuild without cache, redeploy) or pins an older one (bump the pin).
For a component a platform bundles (a rancher/mirrored-* image, k3s or RKE2 labels): open the platform's GitHub releases and the bundled manifest or chart version at the release tag, and the rancher/image-build-* repository for a rebuilt image, until you can name the first release that ships the fix or state that none does yet (fix_planned, upstream_pending, waitingFor).
Nobody answers questions and the operator sees only the proposal, and a check has turns and time for these lookups: finish them instead of handing them on. "Check the release notes for a release that bundles the fix" is your work, not a step in fix.action or fix.change, and "not checked against the release pages" is a skipped check, not an unknown, while those pages are on an allowed host.
get_image lists the other open findings of this image; one that shares this root cause, checked against its own CVE and version, goes into relatedFindings, not into a proposal of its own.
File the verdict with propose_decision, then reply in the sieb format. Its evidence gets one entry per check you ran here: what you checked, the method (file path, inspect call or URL) and the result, also for checks that found nothing. Its references are the advisory and fix pages you fetched. An empty evidence list after checks is an error.`
}
