export type Ecosystem = 'apk' | 'deb' | 'golang' | 'npm' | 'pypi'

export interface VariantPackage {
  name: string
  installed: string
  fixed: string
}

/** Packaging of a CVE family in one ecosystem */
export interface PackageVariant {
  id: string
  family: string
  ecosystem: Ecosystem
  packages: readonly VariantPackage[]
  everyPackage: boolean // true: each CVE hits all packages, false: CVE n hits package n mod length
}

/**
 * Builds the packages of a variant that share one version pair.
 * @param {readonly string[]} names - Package names
 * @param {string} installed - Installed version
 * @param {string} fixed - Fixed version
 * @returns {VariantPackage[]} - Packages
 */
const same = (names: readonly string[], installed: string, fixed: string): VariantPackage[] =>
  names.map((name) => ({ name, installed, fixed }))

export const PACKAGE_VARIANTS: readonly PackageVariant[] = [
  {
    id: 'openssl-apk',
    family: 'openssl',
    ecosystem: 'apk',
    everyPackage: true,
    packages: same(['libcrypto3', 'libssl3'], '3.3.2-r0', '3.3.3-r0'),
  },
  {
    id: 'openssl-deb',
    family: 'openssl',
    ecosystem: 'deb',
    everyPackage: true,
    packages: same(['libssl3', 'openssl'], '3.0.14-1~deb12u2', '3.0.15-1~deb12u1'),
  },
  {
    id: 'curl-apk',
    family: 'curl',
    ecosystem: 'apk',
    everyPackage: true,
    packages: same(['curl', 'libcurl'], '8.10.1-r0', '8.11.1-r0'),
  },
  {
    id: 'busybox-apk',
    family: 'busybox',
    ecosystem: 'apk',
    everyPackage: true,
    packages: same(['busybox', 'busybox-binsh', 'ssl_client'], '1.36.1-r29', '1.36.1-r30'),
  },
  {
    id: 'libxml2-apk',
    family: 'libxml2',
    ecosystem: 'apk',
    everyPackage: false,
    packages: same(['libxml2'], '2.12.7-r0', '2.12.9-r0'),
  },
  {
    id: 'libxml2-deb',
    family: 'libxml2',
    ecosystem: 'deb',
    everyPackage: false,
    packages: same(['libxml2'], '2.9.14+dfsg-1.3~deb12u1', '2.9.14+dfsg-1.3~deb12u2'),
  },
  {
    id: 'zlib-apk',
    family: 'zlib',
    ecosystem: 'apk',
    everyPackage: false,
    packages: same(['zlib'], '1.3.1-r1', '1.3.1-r2'),
  },
  {
    id: 'zlib-deb',
    family: 'zlib',
    ecosystem: 'deb',
    everyPackage: false,
    packages: same(['zlib1g'], '1:1.2.13.dfsg-1', '1:1.2.13.dfsg-1+deb12u1'),
  },
  {
    id: 'musl-apk',
    family: 'musl',
    ecosystem: 'apk',
    everyPackage: true,
    packages: same(['musl', 'musl-utils'], '1.2.5-r0', '1.2.5-r1'),
  },
  {
    id: 'glibc-deb',
    family: 'glibc',
    ecosystem: 'deb',
    everyPackage: true,
    packages: same(['libc6', 'libc-bin'], '2.36-9+deb12u7', '2.36-9+deb12u9'),
  },
  {
    id: 'krb5-deb',
    family: 'krb5',
    ecosystem: 'deb',
    everyPackage: true,
    packages: same(
      ['libkrb5-3', 'libgssapi-krb5-2', 'libk5crypto3'],
      '1.20.1-2+deb12u1',
      '1.20.1-2+deb12u2',
    ),
  },
  {
    id: 'perl-deb',
    family: 'perl',
    ecosystem: 'deb',
    everyPackage: false,
    packages: same(['perl-base'], '5.36.0-7+deb12u1', '5.36.0-7+deb12u2'),
  },
  {
    id: 'stdlib-122',
    family: 'stdlib',
    ecosystem: 'golang',
    everyPackage: false,
    packages: same(['stdlib'], 'v1.22.7', '1.22.12, 1.23.6'),
  },
  {
    id: 'stdlib-123',
    family: 'stdlib',
    ecosystem: 'golang',
    everyPackage: false,
    packages: same(['stdlib'], 'v1.23.2', '1.23.6, 1.24.0'),
  },
  {
    id: 'xnet',
    family: 'xnet',
    ecosystem: 'golang',
    everyPackage: false,
    packages: same(['golang.org/x/net'], 'v0.28.0', '0.33.0'),
  },
  {
    id: 'grpc',
    family: 'grpc',
    ecosystem: 'golang',
    everyPackage: false,
    packages: same(['google.golang.org/grpc'], 'v1.64.0', '1.64.1'),
  },
  {
    id: 'jwt',
    family: 'jwt',
    ecosystem: 'golang',
    everyPackage: false,
    packages: same(['github.com/golang-jwt/jwt/v4'], 'v4.5.0', '4.5.2'),
  },
  {
    id: 'npm',
    family: 'npm',
    ecosystem: 'npm',
    everyPackage: false,
    packages: [
      { name: 'express', installed: '4.19.2', fixed: '4.20.0' },
      { name: 'cross-spawn', installed: '7.0.3', fixed: '7.0.5' },
      { name: 'path-to-regexp', installed: '0.1.7', fixed: '0.1.12' },
      { name: 'cookie', installed: '0.6.0', fixed: '0.7.0' },
      { name: 'body-parser', installed: '1.20.2', fixed: '1.20.3' },
    ],
  },
  {
    id: 'pypi',
    family: 'pypi',
    ecosystem: 'pypi',
    everyPackage: false,
    packages: [
      { name: 'urllib3', installed: '2.2.1', fixed: '2.2.2' },
      { name: 'requests', installed: '2.31.0', fixed: '2.32.0' },
      { name: 'jinja2', installed: '3.1.4', fixed: '3.1.5' },
      { name: 'setuptools', installed: '69.5.1', fixed: '70.0.0' },
    ],
  },
]
