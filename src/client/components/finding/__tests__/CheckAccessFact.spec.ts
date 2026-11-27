import { afterEach, describe, expect, it } from 'vitest'

import type { ImageCheckAccess } from '#core/privateAccess.ts'
import { mountOnAppRoutes, type AppRoutesMount } from '@/__tests__/mountOnAppRoutes'
import CheckAccessFact from '@/components/finding/CheckAccessFact.vue'

let mounted: AppRoutesMount | null = null

/**
 * Builds the access of one image.
 * @param {Partial<ImageCheckAccess>} overrides - Fields to set
 * @returns {ImageCheckAccess} - Access
 */
const access = (overrides: Partial<ImageCheckAccess> = {}): ImageCheckAccess => ({
  imageRef: 'registry.example.com/acme/shop',
  level: 'none',
  credentialId: null,
  credentialLabel: null,
  ...overrides,
})

/**
 * Mounts the fact for the given access list.
 * @param {ImageCheckAccess[]} list - Access per image
 * @returns {Promise<HTMLElement>} - Rendered fact
 */
const render = async (list: ImageCheckAccess[]): Promise<HTMLElement> => {
  mounted = await mountOnAppRoutes(CheckAccessFact, { access: list })

  return mounted.wrapper.element as HTMLElement
}

/**
 * Returns the text of an element with whitespace runs folded into one space.
 * @param {Element} element - Element
 * @returns {string} - Text
 */
const textOf = (element: Element): string => (element.textContent ?? '').replace(/\s+/gu, ' ')

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
})

describe('CheckAccessFact', () => {
  it('names public images and the credential that covers a private one', async () => {
    expect(textOf(await render([access({ level: 'public' })]))).toContain(
      'Auto-check access Public',
    )
    mounted?.wrapper.unmount()

    const covered = await render([
      access({ level: 'credential', credentialId: 3, credentialLabel: 'Acme registry' }),
    ])

    expect(textOf(covered)).toContain('Via Acme registry')
    expect(covered.querySelector('a')).toBeNull()
  })

  it('links an image without access to the Access page', async () => {
    const fact = await render([access()])
    const link = fact.querySelector('a')!

    expect(textOf(fact)).toContain('No access')
    expect(link.getAttribute('href')).toBe('/access')
    expect(link.textContent).toContain('for registry.example.com/acme/shop')
  })

  it('names each image when the finding has several', async () => {
    const fact = await render([
      access({ level: 'public', imageRef: 'docker.io/library/nginx' }),
      access(),
    ])

    expect(textOf(fact)).toContain('docker.io/library/nginx: Public')
    expect(textOf(fact)).toContain('registry.example.com/acme/shop: No access')
  })
})
