import { MAX_CHECK_IMAGES } from '#core/checkLimits.ts'
import { MAX_CREDENTIAL_LABEL_LENGTH } from '#core/credentialFieldReaders.ts'
import { isPlainObject } from '#core/isPlainObject.ts'
import {
  SOURCE_SKIP_REASONS,
  type FetchAccess,
  type RegistryAuth,
  type SourceAnswer,
} from '#core/privateAccess.ts'
import { isClaimImageList } from '#checker/api/claimImages.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import { fullCommit, repoUrlOf } from '#checker/source/sourceValues.ts'

const MAX_REGISTRIES = 10
const MAX_REPO_URLS = 3
const HOST_PATTERN = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?(:\d{1,5})?$/
// printable ASCII without spaces, so neither a docker config nor a git header can be split
const SECRET_PATTERN = /^[\x21-\x7e]{1,4096}$/
// a colon would end the user part of basic auth
const USERNAME_PATTERN = /^[\x21-\x39\x3b-\x7e]{1,256}$/

/**
 * Returns whether a value is a registry login the fetcher can write into a docker config.
 * @param {unknown} value - Raw value
 * @returns {boolean} - Whether host, username and secret are acceptable
 */
const isRegistryAuth = (value: unknown): value is RegistryAuth =>
  isPlainObject(value) &&
  typeof value.host === 'string' &&
  HOST_PATTERN.test(value.host.toLowerCase()) &&
  typeof value.username === 'string' &&
  USERNAME_PATTERN.test(value.username) &&
  typeof value.secret === 'string' &&
  SECRET_PATTERN.test(value.secret)

/**
 * Keeps host, username and secret of a login, and its label when it is short single-line text.
 * @param {RegistryAuth} login - Validated login
 * @returns {RegistryAuth} - Login without unknown fields
 */
const loginOf = ({ host, username, secret, label }: RegistryAuth): RegistryAuth =>
  typeof label === 'string' &&
  Array.from(label).length <= MAX_CREDENTIAL_LABEL_LENGTH &&
  !/\p{Cc}/u.test(label)
    ? { host, username, secret, label }
    : { host, username, secret }

/**
 * Validates sieb's answer of POST /worker/checks/:id/access. The image list is required, so the
 * fetcher never pulls with the check's logins what only the checker names.
 * @param {unknown} body - Parsed JSON body
 * @returns {FetchAccess} - Registry logins and the claim's images
 * @throws {CheckFailure} - When the answer has an unexpected shape or no image list, without echoing it
 */
export const parseFetchAccess = (body: unknown): FetchAccess => {
  if (!isPlainObject(body) || !Array.isArray(body.registries)) {
    throw new CheckFailure('sieb sent an invalid registry access answer')
  }

  const { registries, images } = body

  if (registries.length > MAX_REGISTRIES || !registries.every(isRegistryAuth)) {
    throw new CheckFailure('sieb sent an invalid registry access answer')
  }

  const primary = Array.isArray(images) && isPlainObject(images[0]) ? images[0] : {}

  if (
    !Array.isArray(images) ||
    !isClaimImageList({ imageRef: primary.imageRef, imageDigest: primary.imageDigest, images })
  ) {
    throw new CheckFailure('sieb sent an invalid image list with the registry access')
  }

  return {
    registries: registries.map(loginOf),
    images: images.slice(0, MAX_CHECK_IMAGES) as FetchAccess['images'],
  }
}

/**
 * Returns whether a grant's login is acceptable: both parts null for an anonymous clone, or a
 * username and secret that cannot split the git header.
 * @param {unknown} username - Raw username
 * @param {unknown} secret - Raw secret
 * @returns {boolean} - Whether the login is anonymous or valid
 */
const isGrantLogin = (username: unknown, secret: unknown): boolean =>
  (username === null && secret === null) ||
  (typeof username === 'string' &&
    USERNAME_PATTERN.test(username) &&
    typeof secret === 'string' &&
    SECRET_PATTERN.test(secret))

/**
 * Validates sieb's answer of POST /worker/checks/:id/source.
 * @param {unknown} body - Parsed JSON body
 * @returns {SourceAnswer} - A clone grant with 1 to 3 normalised https URLs, or a skip reason
 * @throws {CheckFailure} - When the answer has an unexpected shape, without echoing it
 */
export const parseSourceAnswer = (body: unknown): SourceAnswer => {
  if (isPlainObject(body) && 'skip' in body) {
    const skip = SOURCE_SKIP_REASONS.find((reason) => reason === body.skip)

    if (skip !== undefined) {
      return { skip }
    }
  }

  const grant = isPlainObject(body) && isPlainObject(body.grant) ? body.grant : null
  const urls = Array.isArray(grant?.repoUrls) ? grant.repoUrls : []
  const repoUrls = urls.map(repoUrlOf).filter((url) => url !== null)

  if (
    grant === null ||
    urls.length === 0 ||
    urls.length > MAX_REPO_URLS ||
    repoUrls.length !== urls.length ||
    !(grant.revision === null || typeof grant.revision === 'string') ||
    !isGrantLogin(grant.username, grant.secret)
  ) {
    throw new CheckFailure('sieb sent an invalid source answer')
  }

  return {
    grant: {
      repoUrls,
      revision: fullCommit(grant.revision as string | null),
      username: grant.username as string | null,
      secret: grant.secret as string | null,
    },
  }
}
