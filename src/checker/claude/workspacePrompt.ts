import type { WorkerClaim } from '#core/check.ts'
import type { PulledImage } from '#checker/workspace/resolveImage.ts'

/**
 * Describes which image content Claude sees: the scanned digest, or the digest a tag pointed to
 * at check time when sieb knows no digest.
 * @param {WorkerClaim} claim - Claimed check
 * @param {PulledImage} image - Pulled image
 * @returns {string} - One prompt line
 */
const pulledLine = (claim: WorkerClaim, image: PulledImage): string =>
  image.scanned
    ? `The worker pulled ${image.ref}, the digest of the scanned image.`
    : `The worker pulled ${image.ref}, the digest ${claim.imageRef} pointed to at check time. The digest of the scanned image is unknown, so image/ can differ from what the scanner saw.`

/**
 * Appends the workspace description to sieb's investigation prompt.
 * @param {WorkerClaim} claim - Claimed check
 * @param {string} platform - Exported image platform
 * @param {PulledImage} image - Pulled image
 * @returns {string} - Full prompt
 */
export const workspacePrompt = (
  claim: WorkerClaim,
  platform: string,
  image: PulledImage,
): string => {
  return `${claim.prompt.trim()}

## Workspace
The working directory holds:
- image/: the flattened filesystem of the image (${platform}); symlinks are kept inside it, ignore files (.gitignore, .ignore, .rgignore) were left out so every file is searchable
- image-config.json: the image config (env, entrypoint, labels, history)
- inventory.json: the syft package inventory of image/, trimmed when large
${pulledLine(claim, image)}
There is no source repository and no runtime or cluster access, so name own_source and runtime under Not checked.
There is no shell. Use Read, Grep and Glob for files, the inspect tools (strings, readelf, objdump, unzip_list, jq) for binaries, archives and JSON, WebFetch for advisories and upstream sources on the allowed hosts (CVE databases, distro trackers, GitHub, Go, package and image registries) and WebSearch to find them. Nothing can be written.
File the verdict with propose_decision, then reply in the sieb format.`
}
