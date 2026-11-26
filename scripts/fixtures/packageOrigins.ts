import type { FixtureImage } from '#scripts/fixtures/fixtureModel.ts'
import {
  PACKAGE_VARIANTS,
  type Ecosystem,
  type VariantPackage,
} from '#scripts/fixtures/packageVariants.ts'

/** Go binaries per image id, Trivy reports a Go package once per binary that embeds it */
const GO_BINARIES: Readonly<Record<string, readonly string[]>> = {
  postgres: ['usr/local/bin/gosu'],
  redis: ['usr/local/bin/gosu'],
  grafana: ['usr/share/grafana/bin/grafana'],
  prometheus: ['bin/prometheus', 'bin/promtool'],
  'cert-manager': ['app/cmd/controller/controller'],
  coredns: ['coredns'],
  traefik: ['usr/local/bin/traefik'],
  'local-path': ['usr/local/bin/local-path-provisioner'],
  'metrics-server': ['app/metrics-server'],
}

/** Images whose reports predate the additional Trivy fields, so the missing case shows */
const WITHOUT_ORIGIN = new Set(['mariadb', 'busybox', 'alertmanager'])

/** Images whose OS packages carry an empty target */
const EMPTY_OS_TARGET = new Set(['demo-app'])

/**
 * Finds the ecosystem of a package through the variants of its image.
 * @param {FixtureImage} image - Image
 * @param {VariantPackage} pkg - Package
 * @returns {Ecosystem | null} - Ecosystem, null when no variant of the image lists the package
 */
const ecosystemOf = (image: FixtureImage, pkg: VariantPackage): Ecosystem | null =>
  PACKAGE_VARIANTS.find(
    (variant) =>
      image.variants.includes(variant.id) &&
      variant.packages.some((candidate) => candidate.name === pkg.name),
  )?.ecosystem ?? null

/**
 * Builds the PURL of an OS package, epoch as qualifier as Trivy writes it.
 * @param {FixtureImage} image - Image
 * @param {VariantPackage} pkg - Package
 * @returns {string} - PURL
 */
const osPurl = (image: FixtureImage, pkg: VariantPackage): string => {
  const [epoch, version] = pkg.installed.includes(':')
    ? pkg.installed.split(':', 2)
    : [null, pkg.installed]
  const encoded = encodeURIComponent(version ?? pkg.installed)

  return image.os.family === 'alpine'
    ? `pkg:apk/alpine/${pkg.name}@${encoded}?arch=x86_64&distro=${image.os.name}`
    : `pkg:deb/debian/${pkg.name}@${encoded}?arch=amd64&distro=debian-${image.os.name}${epoch ? `&epoch=${epoch}` : ''}`
}

/**
 * Builds the origin fields of a package in an image, one field set per vulnerability entry
 * Trivy writes: a Go package once per binary, everything else once.
 * @param {FixtureImage} image - Image
 * @param {VariantPackage} pkg - Package
 * @returns {Record<string, string>[]} - target, pkgPath, class, packageType and packagePURL
 */
export const packageOriginFields = (
  image: FixtureImage,
  pkg: VariantPackage,
): Record<string, string>[] => {
  const ecosystem = ecosystemOf(image, pkg)

  if (WITHOUT_ORIGIN.has(image.id) || ecosystem === null) {
    return [{ target: '' }]
  }

  if (ecosystem === 'golang') {
    return (GO_BINARIES[image.id] ?? ['usr/local/bin/app']).map((target) => ({
      class: 'lang-pkgs',
      packagePURL: `pkg:golang/${pkg.name}@${pkg.installed}`,
      packageType: 'gobinary',
      target,
    }))
  }

  if (ecosystem === 'npm') {
    return [
      {
        class: 'lang-pkgs',
        packagePURL: `pkg:npm/${pkg.name}@${pkg.installed}`,
        packageType: 'npm',
        target: 'app/package-lock.json',
      },
    ]
  }

  if (ecosystem === 'pypi') {
    return [
      {
        class: 'lang-pkgs',
        packagePURL: `pkg:pypi/${pkg.name}@${pkg.installed}`,
        packageType: 'python-pkg',
        pkgPath: `usr/local/lib/python3.12/site-packages/${pkg.name}-${pkg.installed}.dist-info/METADATA`,
        target: 'Python',
      },
    ]
  }

  return [
    {
      class: 'os-pkgs',
      packagePURL: osPurl(image, pkg),
      packageType: image.os.family,
      target: EMPTY_OS_TARGET.has(image.id)
        ? ''
        : `${image.server}/${image.repository}:${image.tag} (${image.os.family} ${image.os.name})`,
    },
  ]
}
