import type { InstanceDetails } from '#core/instance.ts'
import { asPlainText, asRecord } from '#server/sources/mapping/jsonAccess.ts'

export type PackageOriginFields = Pick<
  InstanceDetails,
  'locations' | 'packageType' | 'packageClass' | 'purl'
>

const MAX_PATH_LENGTH = 1024
const MAX_PURL_LENGTH = 512
const MAX_TYPE_LENGTH = 64

/**
 * Reads where Trivy found the package of one vulnerability entry: target and pkgPath, the
 * packageType and class, and the PURL from packagePURL (trivy-operator), pkgIdentifier.PURL or
 * purl. Every field is optional, missing, oversized or non-plain values stay null, a PURL also
 * needs the pkg: scheme.
 * @param {Record<string, unknown>} vulnerability - Vulnerability entry of a report
 * @returns {PackageOriginFields} - Locations, package type, class and PURL
 */
export const parsePackageOrigin = (vulnerability: Record<string, unknown>): PackageOriginFields => {
  const target = asPlainText(vulnerability.target, MAX_PATH_LENGTH)
  const pkgPath = asPlainText(vulnerability.pkgPath, MAX_PATH_LENGTH)
  const identifier = asRecord(vulnerability.pkgIdentifier)
  const purl = [vulnerability.packagePURL, identifier.PURL, identifier.purl, vulnerability.purl]
    .map((value) => asPlainText(value, MAX_PURL_LENGTH))
    .find((value) => value !== null && /^pkg:/i.test(value))

  return {
    locations: target === null && pkgPath === null ? [] : [{ target, pkgPath }],
    packageType: asPlainText(vulnerability.packageType, MAX_TYPE_LENGTH),
    packageClass: asPlainText(vulnerability.class, MAX_TYPE_LENGTH),
    purl: purl ?? null,
  }
}
