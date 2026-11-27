import type { PatchLayer, ProposalClaims, ProposalVerdict } from '#core/proposal.ts'

/** Verdicts that mean patching, their proposals must name the patch action */
export const PATCH_VERDICTS = ['needs_patch', 'fix_planned'] as const satisfies ProposalVerdict[]

/** What a patch action has to name, for the tool schema and the validation error */
export const PATCH_ACTION_HINT =
  'one line, the step at the closest layer the operator controls that pulls in a published fix, naming the layer: "dependency: bump <module> to <version>" (lockfile, go.mod, requirements, a package installed in the Dockerfile); "base image: rebuild on <tag or digest> (<package> <version>)" when the base publisher has released one; when the tag the build already uses was republished with the fix, "base image: rebuild without cache and redeploy, <tag> now ships <package> <version>", else "base image: apk upgrade <package>" or the distro equivalent when the distro has the fixed package; "image: bump to <tag or digest>" for a third-party image; "<platform>: upgrade to <release>" for a component a platform such as k3s bundles and manages, never an override of it. Find the layer from sieb\'s facts (Found in paths, package class os-pkgs or language, PURL, installed and fixed version; the owner is only a hint), the Dockerfile and lockfiles of an own image, and image labels such as org.opencontainers.image.base.name; check on release pages and registries that the fix is published today. If no layer you control has one, say what to wait for ("k3s: wait for a release bundling <component> <version>", "no fixed version yet, watch <advisory>") and use fix_planned with a review date. Manual overrides only as an explicit exception for high risk, KEV listed and reachable'

const DIGEST = /(?<![\w./:@-])(?:([\w./:-]+)@)?(sha256:[0-9a-f]{12,64})\b/u

const TARGET_AFTER_TO = /\bto\s+(\S*\d\S*)/u

const BASE_AFTER_REBUILD_ON = /\brebuild\s+on\s+([^\s()]*[\d:@][^\s()]*)/iu

const BASE_IMAGE_PREFIX = /^\s*base image:/iu

const TRAILING_PUNCTUATION = /[.,;:)]+$/u

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/gu

/**
 * Returns whether a verdict means patching.
 * @param {ProposalVerdict} verdict - Proposal verdict
 * @returns {boolean} - True for needs_patch and fix_planned
 */
export const isPatchVerdict = (verdict: ProposalVerdict): boolean =>
  (PATCH_VERDICTS as readonly ProposalVerdict[]).includes(verdict)

/**
 * Returns the patch action of a proposal, only for a patch verdict; proposals stored before the
 * action existed have none.
 * @param {Pick<ProposalClaims, 'verdict' | 'fix'>} claims - Verdict and fix path
 * @returns {string | null} - Action, null for other verdicts or when none is stored
 */
export const patchActionOf = (claims: Pick<ProposalClaims, 'verdict' | 'fix'>): string | null =>
  isPatchVerdict(claims.verdict) ? (claims.fix?.action ?? null) : null

/**
 * Returns the digest a patch action names as a valid ref: name@sha256:... with the tag of a
 * tagged ref left out, or the bare digest when no image name precedes it.
 * @param {string} action - Patch action
 * @returns {string | null} - Digest ref, null without a digest
 */
const digestOf = (action: string): string | null => {
  const match = DIGEST.exec(action)

  if (!match) {
    return null
  }

  const [, ref, digest] = match
  const slash = ref?.lastIndexOf('/') ?? -1
  const colon = ref?.indexOf(':', slash + 1) ?? -1
  const name = ref === undefined || colon === -1 ? ref : ref.slice(0, colon)

  return name !== undefined && /[a-z]/iu.test(name) ? `${name}@${digest}` : (digest ?? null)
}

/**
 * Returns the first token after a pattern, without trailing punctuation.
 * @param {RegExp} pattern - Pattern with the token as first group
 * @param {string} action - Patch action
 * @returns {string | null} - Token, null when the pattern does not match
 */
const tokenAfter = (pattern: RegExp, action: string): string | null =>
  pattern.exec(action)?.[1]?.replace(TRAILING_PUNCTUATION, '') || null

/**
 * Returns whether an action names a version as a whole token, not as the prefix of a longer one.
 * @param {string} action - Patch action
 * @param {string} version - Version
 * @returns {boolean} - True when the version stands on its own
 */
const namesVersion = (action: string, version: string): boolean =>
  new RegExp(`(?<![\\w.+-])${version.replace(REGEX_SPECIAL, '\\$&')}(?![\\w+-]|\\.\\w)`, 'u').test(
    action,
  )

/**
 * Picks the copyable target of a patch action: a digest ref; for a base image action the tag or
 * ref after "rebuild on"; else the version or tag after "to"; else the stated fixed version when
 * the action names it as a whole token.
 * @param {string} action - Patch action
 * @param {string | null} fixedVersion - Fixed version of the fix path
 * @param {PatchLayer | null} layer - Layer of the fix path, a base image prefers the ref to rebuild on
 * @returns {string | null} - Digest, version or tag, null when the action names none
 */
export const patchTargetOf = (
  action: string,
  fixedVersion: string | null,
  layer: PatchLayer | null = null,
): string | null => {
  const digest = digestOf(action)

  if (digest !== null) {
    return digest
  }

  const base =
    layer === 'base_image' || BASE_IMAGE_PREFIX.test(action)
      ? tokenAfter(BASE_AFTER_REBUILD_ON, action)
      : null

  return (
    base ??
    tokenAfter(TARGET_AFTER_TO, action) ??
    (fixedVersion && namesVersion(action, fixedVersion) ? fixedVersion : null)
  )
}
