import { BlockList, isIP } from 'node:net'

import { ADDRESS_NOT_ALLOWED } from '#core/accessTestVerdict.ts'
import { isInternalHostName } from '#core/internalHostNames.ts'

// loopback, private, CGNAT, link-local (cloud metadata), documentation, benchmark, multicast, reserved
const BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]
// unspecified, loopback, discard, local-use NAT64, documentation, unique-local, link-local, site-local, multicast
const BLOCKED_V6: [string, number][] = [
  ['::', 128],
  ['::1', 128],
  ['100::', 64],
  ['64:ff9b:1::', 48],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
]
const BLOCKED = new BlockList()

for (const [address, prefix] of BLOCKED_V4) {
  BLOCKED.addSubnet(address, prefix, 'ipv4')
}

for (const [address, prefix] of BLOCKED_V6) {
  BLOCKED.addSubnet(address, prefix, 'ipv6')
}

/**
 * Expands an IPv6 address into its eight 16-bit groups, a trailing dotted IPv4 part included.
 * @param {string} address - Valid IPv6 address
 * @returns {number[]} - Eight groups
 */
const groupsOf = (address: string): number[] => {
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/u.exec(address)
  const bytes = dotted === null ? [] : dotted.slice(1).map(Number)
  const text =
    dotted === null
      ? address
      : `${address.slice(0, dotted.index)}${(((bytes[0] ?? 0) << 8) | (bytes[1] ?? 0)).toString(16)}:${(((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0)).toString(16)}`
  const [head = '', tail] = text.split('::')
  const start = head === '' ? [] : head.split(':')
  const end = tail === undefined || tail === '' ? [] : tail.split(':')
  const fill = tail === undefined ? 0 : 8 - start.length - end.length

  return [...start, ...Array.from({ length: fill }, () => '0'), ...end].map((group) =>
    Number.parseInt(group, 16),
  )
}

/**
 * Returns the IPv4 address a NAT64 address of 64:ff9b::/96 embeds.
 * @param {string} address - Valid IPv6 address
 * @returns {string | null} - Embedded IPv4 address, null for any other address
 */
const nat64Embedded = (address: string): string | null => {
  const groups = groupsOf(address.toLowerCase())
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0] = groups

  if (a !== 0x64 || b !== 0xff9b || c !== 0 || d !== 0 || e !== 0 || f !== 0) {
    return null
  }

  return [g >> 8, g & 0xff, h >> 8, h & 0xff].join('.')
}

/**
 * Returns whether an address is a public unicast address sieb may send a credential test to:
 * not loopback, private (RFC 1918), CGNAT, link-local with the cloud metadata endpoints,
 * unique-local, unspecified, multicast or reserved, also when mapped into IPv6 or NAT64.
 * @param {string} address - IP address
 * @returns {boolean} - True for a public address, false for any other value
 */
export const isPublicAddress = (address: string): boolean => {
  const family = isIP(address)

  if (family === 4) {
    return !BLOCKED.check(address, 'ipv4')
  }

  if (family !== 6) {
    return false
  }

  const embedded = nat64Embedded(address)

  return embedded === null ? !BLOCKED.check(address, 'ipv6') : isPublicAddress(embedded)
}

/**
 * Returns why a probe URL may not be requested before its host is resolved: not https, with
 * credentials, a port other than 443 the credential does not name, an internal name or an IP
 * address that is not public.
 * @param {URL} url - Probe URL
 * @param {readonly number[]} ports - Ports the user set on the credential's hosts
 * @returns {string | null} - Reason, null when the URL may be requested
 */
export const urlRefusal = (url: URL, ports: readonly number[]): string | null => {
  const host = url.hostname.replace(/^\[|\]$/gu, '')

  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    return 'not https'
  }

  if (url.port !== '' && !ports.includes(Number(url.port))) {
    return 'port not allowed'
  }

  if (isIP(host) !== 0) {
    return isPublicAddress(host) ? null : ADDRESS_NOT_ALLOWED
  }

  return isInternalHostName(host) ? ADDRESS_NOT_ALLOWED : null
}
