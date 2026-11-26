// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { MeResponse } from '#core/apiTypes.ts'
import { createApp } from '#server/http/createApp.ts'

import { requestJson, testAppDeps } from '#server/http/__tests__/appFixtures.ts'

describe('GET /api/me', () => {
  it('answers the user, the auth mode and the source code of the running version', async () => {
    const app = createApp(testAppDeps({ version: '0.2.1' }))

    expect(await requestJson<MeResponse>(app, '/api/me')).toEqual({
      status: 200,
      body: {
        username: 'dev',
        authMode: 'header',
        version: '0.2.1',
        sourceCodeUrl: 'https://github.com/bernhardkelm/sieb/tree/0.2.1',
      },
    })
  })

  it('links the source code of a fork', async () => {
    const app = createApp(
      testAppDeps({ version: '0.2.1', sourceCodeUrl: 'https://git.example.com/acme/sieb' }),
    )
    const { body } = await requestJson<MeResponse>(app, '/api/me')

    expect(body.sourceCodeUrl).toBe('https://git.example.com/acme/sieb')
  })
})
