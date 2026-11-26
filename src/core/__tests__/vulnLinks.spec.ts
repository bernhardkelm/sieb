import { describe, expect, it } from 'vitest'

import { isWebUrl, vulnLinks } from '#core/vulnLinks.ts'

describe('vulnLinks', () => {
  it('adds a web primary link next to NVD and the KEV catalog', () => {
    expect(
      vulnLinks({ vulnId: 'CVE-2025-1', kev: true, primaryLink: 'https://example.org/a' }).map(
        (link) => link.label,
      ),
    ).toEqual(['NVD', 'KEV catalog', 'Advisory'])
  })

  it('drops primary links that are no http or https URL', () => {
    for (const primaryLink of ['javascript:alert(1)', 'data:text/html,x', '/relative', 'nope']) {
      expect(
        vulnLinks({ vulnId: 'GHSA-x', kev: false, primaryLink }).map((link) => link.label),
      ).toEqual(['GitHub advisory'])
    }
  })

  it('accepts only http and https', () => {
    expect(isWebUrl('http://example.org')).toBe(true)
    expect(isWebUrl('ftp://example.org')).toBe(false)
  })
})
