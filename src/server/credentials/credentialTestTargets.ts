import type { DatabaseSync } from 'node:sqlite'

import { coveringScope, type AccessScope } from '#core/accessScope.ts'
import { defaultCandidates } from '#core/defaultSourceTarget.ts'
import { splitImageRef } from '#core/imageRefParts.ts'
import { mappedRepository } from '#core/repositoryResolution.ts'
import { parseRepositoryUrl, type RepositoryRef } from '#core/repositoryUrl.ts'
import type { RegistryTarget } from '#server/credentials/probe/registryProbe.ts'

export const MAX_TEST_TARGETS = 20

const IMAGE_REF_ROWS = `
  SELECT image_ref, MIN(resolved_at IS NOT NULL) AS resolved FROM findings
  GROUP BY image_ref ORDER BY resolved, image_ref`

/**
 * Lists the distinct image refs of sieb's findings, images with open findings first.
 * @param {DatabaseSync} db - Open database
 * @returns {string[]} - Image refs
 */
const listImageRefs = (db: DatabaseSync): string[] =>
  (db.prepare(IMAGE_REF_ROWS).all() as { image_ref: string }[]).map((row) => row.image_ref)

/**
 * Returns the reference to resolve for an image: the digest of the most recently seen
 * instance, open ones first, else its tag, else latest.
 * @param {DatabaseSync} db - Open database
 * @param {string} imageRef - Image ref
 * @returns {string} - Digest or tag
 */
const referenceOf = (db: DatabaseSync, imageRef: string): string => {
  const row = db
    .prepare(
      `SELECT i.image_digest, i.image_tag FROM finding_instances i JOIN findings f ON f.id = i.finding_id
       WHERE f.image_ref = ? AND (i.image_digest IS NOT NULL OR i.image_tag IS NOT NULL)
       ORDER BY i.resolved_at IS NOT NULL, i.image_digest IS NULL, i.last_seen DESC LIMIT 1`,
    )
    .get(imageRef) as { image_digest: string | null; image_tag: string | null } | undefined
  const digest = row?.image_digest ?? ''
  const tag = row?.image_tag ?? ''

  if (/^[a-z0-9]+:[a-f0-9]{32,128}$/u.test(digest)) {
    return digest
  }

  return /^[\w][\w.-]{0,127}$/u.test(tag) ? tag : 'latest'
}

/**
 * Lists up to MAX_TEST_TARGETS images of sieb's findings that a credential covers.
 * @param {DatabaseSync} db - Open database
 * @param {AccessScope} scope - Credential under test
 * @returns {RegistryTarget[]} - Images with the reference to resolve
 */
export const registryTestTargets = (db: DatabaseSync, scope: AccessScope): RegistryTarget[] => {
  const targets: RegistryTarget[] = []

  for (const imageRef of listImageRefs(db)) {
    const parts = splitImageRef(imageRef)

    if (parts !== null && coveringScope([scope], 'registry', parts.host, parts.path) !== null) {
      targets.push({ imageRef, ...parts, reference: referenceOf(db, imageRef) })
    }

    if (targets.length >= MAX_TEST_TARGETS) {
      break
    }
  }

  return targets
}

/**
 * Lists up to MAX_TEST_TARGETS repositories a credential covers: those the repository mappings
 * of all credentials derive from sieb's images, then those the default mappings name for them,
 * then those checks reported as checked out.
 * @param {DatabaseSync} db - Open database
 * @param {AccessScope} scope - Credential under test
 * @param {readonly AccessScope[]} scopes - All credentials, for their repository mappings
 * @returns {RepositoryRef[]} - Distinct repositories
 */
export const gitTestTargets = (
  db: DatabaseSync,
  scope: AccessScope,
  scopes: readonly AccessScope[],
): RepositoryRef[] => {
  const checked = (
    db
      .prepare(
        `SELECT DISTINCT json_extract(source, '$.repoUrl') AS url FROM checks WHERE source IS NOT NULL`,
      )
      .all() as {
      url: unknown
    }[]
  ).map((row) => (typeof row.url === 'string' ? parseRepositoryUrl(row.url) : null))
  const imageRefs = listImageRefs(db)
  const candidates = [
    ...imageRefs.map((imageRef) => mappedRepository(scopes, imageRef)),
    ...imageRefs.flatMap(
      (imageRef) => defaultCandidates(scopes, imageRef, true)?.repositories ?? [],
    ),
    ...checked,
  ]
  const targets = new Map<string, RepositoryRef>()

  for (const repository of candidates) {
    if (repository === null || repository === 'not_https' || targets.has(repository.repoUrl)) {
      continue
    }

    if (coveringScope([scope], 'git', repository.host, repository.path) !== null) {
      targets.set(repository.repoUrl, repository)
    }

    if (targets.size >= MAX_TEST_TARGETS) {
      break
    }
  }

  return [...targets.values()]
}
