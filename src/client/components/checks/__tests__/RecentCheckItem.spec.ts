import { afterEach, describe, expect, it } from 'vitest'

import { buildCheck } from '@/__tests__/checkBuilders'
import { mountOnAppRoutes, type AppRoutesMount } from '@/__tests__/mountOnAppRoutes'
import RecentCheckItem from '@/components/checks/RecentCheckItem.vue'

let mounted: AppRoutesMount | null = null

/**
 * Renders a finished check with the given source.
 * @param {Parameters<typeof buildCheck>[0]} overrides - Check fields
 * @returns {Promise<string>} - Rendered text
 */
const renderText = async (overrides: Parameters<typeof buildCheck>[0]): Promise<string> => {
  mounted = await mountOnAppRoutes(RecentCheckItem, {
    check: buildCheck({
      state: 'done',
      position: null,
      finishedAt: '2026-11-27T09:00:00.000Z',
      ...overrides,
    }),
  })

  return mounted.wrapper.text()
}

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
})

describe('RecentCheckItem source', () => {
  it('names the repository and the short revision the check read', async () => {
    const text = await renderText({
      source: {
        repoUrl: 'https://gitlab.example.com/acme/shop.git',
        revision: '3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39',
        fromLabel: true,
        refKind: 'label',
        ref: null,
      },
    })

    expect(text).toContain('Sourcegitlab.example.com/acme/shop@3f2a9c1')
  })

  it('names the default branch without a revision and leaves the fact out without source', async () => {
    expect(
      await renderText({
        source: {
          repoUrl: 'https://github.com/acme/shop',
          revision: null,
          fromLabel: false,
          refKind: 'default_branch',
          ref: null,
        },
      }),
    ).toContain('github.com/acme/shop, default branch')
    mounted?.wrapper.unmount()

    expect(await renderText({ source: null })).not.toContain('Source')
  })
})
