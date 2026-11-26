/** Upstream component whose CVEs several package variants share */
export interface CveFamily {
  id: string
  count: number
  titles: readonly string[]
}

export const CVE_FAMILIES: readonly CveFamily[] = [
  {
    id: 'openssl',
    count: 12,
    titles: [
      'openssl: denial of service via crafted X.509 certificate',
      'openssl: out-of-bounds read in SM2 decryption',
      'openssl: unbounded memory growth with session handling in TLSv1.3',
      'openssl: excessive time spent checking DSA keys',
      'openssl: possible buffer overread in SSL_select_next_proto',
      'openssl: timing side channel in RSA decryption',
    ],
  },
  {
    id: 'curl',
    count: 4,
    titles: [
      'curl: netrc and redirect credential leak',
      'curl: ASN.1 date parser overread',
      'curl: HSTS subdomain overwrites parent cache entry',
    ],
  },
  {
    id: 'busybox',
    count: 3,
    titles: ['busybox: use-after-free in awk', 'busybox: out-of-bounds write in hush'],
  },
  {
    id: 'libxml2',
    count: 3,
    titles: [
      'libxml2: use-after-free in xmlValidatePopElement',
      'libxml2: stack overflow in xmlSnprintfElementContent',
    ],
  },
  { id: 'zlib', count: 2, titles: ['zlib: heap buffer overflow in inflateGetHeader'] },
  { id: 'musl', count: 2, titles: ['musl: out-of-bounds write in iconv EUC-KR decoder'] },
  {
    id: 'glibc',
    count: 3,
    titles: [
      'glibc: buffer overflow in iconv ISO-2022-CN-EXT',
      'glibc: assertion failure in getaddrinfo',
    ],
  },
  { id: 'krb5', count: 3, titles: ['krb5: memory leak in GSS message token handling'] },
  { id: 'perl', count: 2, titles: ['perl: heap buffer overflow in transliteration'] },
  {
    id: 'stdlib',
    count: 16,
    titles: [
      'golang: net/http: request smuggling via chunked encoding',
      'golang: encoding/gob: stack exhaustion with deeply nested structures',
      'golang: go/build/constraint: stack exhaustion in Parse',
      'golang: crypto/x509: excessive resource use verifying certificate chains',
      'golang: net/netip: unexpected behavior from Is methods for IPv4-mapped IPv6',
      'golang: archive/zip: incorrect handling of certain ZIP archives',
      'golang: html/template: improper escaping in JS template literals',
    ],
  },
  {
    id: 'xnet',
    count: 4,
    titles: [
      'golang.org/x/net/html: non-linear parsing of case-insensitive content',
      'golang.org/x/net: HTTP proxy bypass using IPv6 zone IDs',
    ],
  },
  { id: 'grpc', count: 2, titles: ['grpc-go: private tokens could appear in logs'] },
  {
    id: 'jwt',
    count: 2,
    titles: ['golang-jwt: excessive memory allocation during header parsing'],
  },
  {
    id: 'npm',
    count: 6,
    titles: [
      'express: open redirect in malformed URLs',
      'cross-spawn: regular expression denial of service',
      'path-to-regexp: backtracking regular expressions',
      'cookie: accepts cookie name, path and domain with out of bounds characters',
      'body-parser: denial of service when url encoding is enabled',
    ],
  },
  {
    id: 'pypi',
    count: 5,
    titles: [
      'urllib3: proxy-authorization header kept during cross-origin redirects',
      'requests: session verify=False persists for the connection',
      'jinja2: sandbox breakout through indirect reference to format method',
      'setuptools: remote code execution via download functions in package_index',
    ],
  },
]
