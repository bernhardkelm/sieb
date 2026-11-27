// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { AccessCredentialsResponse } from '#core/privateAccess.ts'
import {
  GITLAB_INPUT,
  GITLAB_SECRET,
  OTHER_KEY,
  storeCredential,
  testVault,
} from '#server/credentials/__tests__/credentialFixtures.ts'
import { openCredential } from '#server/credentials/credentialSecrets.ts'
import { MAX_CREDENTIALS } from '#server/credentials/credentialWriteChecks.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { getCredentialRow } from '#server/db/credentialRepository.ts'
import { requestJson } from '#server/http/__tests__/appFixtures.ts'
import {
  ALICE,
  credentialApp,
  GITHUB_INPUT,
  send,
} from '#server/http/routes/__tests__/credentialRouteFixtures.ts'

describe('credential routes', () => {
  it('needs a signed-in user and the same-origin JSON write rules', async () => {
    const { app } = credentialApp()

    expect((await requestJson(app, '/api/credentials')).status).toBe(401)
    expect((await requestJson(app, '/api/credentials', 'POST', GITLAB_INPUT)).status).toBe(401)
    expect(
      (
        await app.request('/api/credentials', {
          method: 'POST',
          headers: ALICE,
          body: JSON.stringify(GITLAB_INPUT),
        })
      ).status,
    ).toBe(415)
    expect(
      (
        await requestJson(app, '/api/credentials', 'POST', GITLAB_INPUT, {
          ...ALICE,
          Origin: 'https://evil.example.org',
        })
      ).status,
    ).toBe(403)
  })

  it('answers 404 credentials_disabled for every write without the key and lists nothing', async () => {
    const { app } = credentialApp({ vault: null })
    const list = await send<AccessCredentialsResponse>(app, '/api/credentials')

    expect(list.body).toEqual({ enabled: false, fetcherConfigured: false, credentials: [] })
    expect(list.status).toBe(200)

    for (const [method, path] of [
      ['POST', '/api/credentials'],
      ['PATCH', '/api/credentials/1'],
      ['DELETE', '/api/credentials/1'],
      ['POST', '/api/credentials/1/test'],
    ] as const) {
      expect(await send(app, path, method, GITLAB_INPUT)).toMatchObject({
        status: 404,
        body: { error: 'credentials_disabled' },
      })
    }
  })

  it('stores a credential sealed, answers its view without the secret and logs without it', async () => {
    const { app, logs, deps, vault } = credentialApp()
    const created = await send(app, '/api/credentials', 'POST', GITLAB_INPUT)
    const list = await send<AccessCredentialsResponse>(app, '/api/credentials')
    const row = getCredentialRow(deps.db, created.body.id)

    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      provider: 'gitlab',
      registryHost: 'registry.example.com',
      gitHost: 'gitlab.example.com',
      pathPrefix: 'acme',
      repoMapping: {
        registryPrefix: 'registry.example.com/acme',
        repoPrefix: 'gitlab.example.com/acme',
      },
      username: 'deploy-bot',
      createdBy: 'alice',
      lastUsedAt: null,
      lastTest: {
        registry: { checked: 2, ok: 2, failures: [] },
        git: { checked: 2, ok: 2, failures: [] },
      },
      secretReadable: true,
    })
    expect(list.body).toMatchObject({ enabled: true, credentials: [{ id: created.body.id }] })

    for (const text of [created.text, list.text, ...logs]) {
      expect(text).not.toContain(GITLAB_SECRET)
      expect(text).not.toContain('"secret"')
    }

    expect(logs).toEqual([expect.stringContaining('access credential created: by="alice"')])
    expect(logs[0]).not.toContain('deploy-bot')
    expect(Buffer.from(row?.secret_ciphertext ?? []).toString('utf8')).not.toContain(GITLAB_SECRET)
    expect(row && vault && openCredential(vault, row)).toEqual({
      username: 'deploy-bot',
      secret: GITLAB_SECRET,
    })
    expect(created.text).not.toContain('ciphertext')
  })

  it('validates the body and refuses a second credential of the same scope and more than the cap', async () => {
    const { app, deps, vault } = credentialApp()

    expect(
      await send(app, '/api/credentials', 'POST', { ...GITLAB_INPUT, username: undefined }),
    ).toMatchObject({
      status: 400,
      body: { error: 'validation', errors: [{ field: 'username', code: 'required' }] },
    })
    expect((await send(app, '/api/credentials', 'POST', GITLAB_INPUT)).status).toBe(201)
    expect(
      await send(app, '/api/credentials', 'POST', { ...GITLAB_INPUT, label: 'again' }),
    ).toMatchObject({
      status: 409,
      body: { error: 'duplicate_scope' },
    })

    for (let index = 1; index < MAX_CREDENTIALS; index += 1) {
      storeCredential(deps.db, vault as CredentialVault, {
        ...GITHUB_INPUT,
        pathPrefix: `team${index}`,
      })
    }

    expect(await send(app, '/api/credentials', 'POST', GITHUB_INPUT)).toMatchObject({
      status: 409,
      body: { error: 'too_many_credentials' },
    })
  })

  it('changes fields and keeps the stored secret unless a new one is sent', async () => {
    const { app, deps, vault, logs } = credentialApp()
    const { id } = storeCredential(deps.db, vault as CredentialVault)
    const renamed = await send(app, `/api/credentials/${id}`, 'PATCH', {
      label: 'Renamed',
      username: 'bot2',
    })

    expect(renamed).toMatchObject({
      status: 200,
      body: { label: 'Renamed', username: 'bot2', pathPrefix: 'acme' },
    })
    expect(openCredential(vault as CredentialVault, getCredentialRow(deps.db, id)!)).toEqual({
      username: 'bot2',
      secret: GITLAB_SECRET,
    })

    const replaced = await send(app, `/api/credentials/${id}`, 'PATCH', {
      secret: 'glpat-new-secret-value',
    })

    expect(replaced.text).not.toContain('glpat-new-secret-value')
    expect(openCredential(vault as CredentialVault, getCredentialRow(deps.db, id)!)?.secret).toBe(
      'glpat-new-secret-value',
    )
    expect(await send(app, `/api/credentials/${id}`, 'PATCH', { uses: ['ssh'] })).toMatchObject({
      status: 400,
    })
    expect((await send(app, '/api/credentials/999', 'PATCH', { label: 'x' })).status).toBe(404)
    expect(logs.filter((line) => line.includes('updated'))).toHaveLength(2)
  })

  it('asks for the token again before it can reach another provider or a new host', async () => {
    const { app, deps, vault } = credentialApp()
    const { id } = storeCredential(deps.db, vault as CredentialVault)

    for (const patch of [
      { registryHost: 'registry.attacker.example', repoMapping: null },
      { gitHost: 'gitlab.attacker.example', repoMapping: null },
      { provider: 'github', registryHost: null, gitHost: null, repoMapping: null, username: null },
    ]) {
      expect(await send(app, `/api/credentials/${id}`, 'PATCH', patch)).toMatchObject({
        status: 409,
        body: { error: 'secret_required' },
      })
    }

    expect(getCredentialRow(deps.db, id)?.registry_host).toBe('registry.example.com')
    expect(
      await send(app, `/api/credentials/${id}`, 'PATCH', { uses: ['registry'], gitHost: null }),
    ).toMatchObject({ status: 200, body: { gitHost: null } })
    expect(
      await send(app, `/api/credentials/${id}`, 'PATCH', {
        registryHost: 'registry.other.example',
        repoMapping: null,
        secret: 'glpat-entered-for-the-new-host',
      }),
    ).toMatchObject({ status: 200, body: { registryHost: 'registry.other.example' } })
  })

  it('refuses a mapping outside the credential', async () => {
    const { app } = credentialApp()

    expect(
      await send(app, '/api/credentials', 'POST', {
        ...GITLAB_INPUT,
        repoMapping: { registryPrefix: 'ghcr.io/acme', repoPrefix: 'gitlab.example.com/acme' },
      }),
    ).toMatchObject({
      status: 400,
      body: { errors: [{ field: 'repoMapping.registryPrefix', code: 'outside_scope' }] },
    })
  })

  it('throttles the tests of a credential', async () => {
    const { app, deps, vault } = credentialApp({ testLimits: {} })
    const { id } = storeCredential(deps.db, vault as CredentialVault)
    const other = storeCredential(deps.db, vault as CredentialVault, GITHUB_INPUT)

    expect((await send(app, `/api/credentials/${id}/test`, 'POST', {})).status).toBe(200)

    const again = await app.request(`/api/credentials/${id}/test`, {
      method: 'POST',
      headers: { ...ALICE, 'Content-Type': 'application/json' },
      body: '{}',
    })

    expect(again.status).toBe(429)
    expect(again.headers.get('retry-after')).toBe('10')
    expect(await again.json()).toEqual({ error: 'test_cooldown' })

    expect((await send(app, `/api/credentials/${other.id}/test`, 'POST', {})).status).toBe(200)
    expect((await send(app, `/api/credentials/${other.id + 1}/test`, 'POST', {})).status).toBe(404)
  })

  it('asks to re-enter a secret sealed with another key', async () => {
    const { app, deps } = credentialApp()
    const { id } = storeCredential(deps.db, testVault(OTHER_KEY))
    const list = await send<AccessCredentialsResponse>(app, '/api/credentials')

    expect(list.body.credentials[0]?.secretReadable).toBe(false)
    expect(await send(app, `/api/credentials/${id}`, 'PATCH', { label: 'x' })).toMatchObject({
      status: 409,
      body: { error: 'secret_unreadable' },
    })
    expect(await send(app, `/api/credentials/${id}/test`, 'POST', {})).toMatchObject({
      status: 409,
      body: { error: 'secret_unreadable' },
    })
    expect(
      await send(app, `/api/credentials/${id}`, 'PATCH', { secret: 'glpat-re-entered' }),
    ).toMatchObject({
      status: 200,
      body: { secretReadable: true },
    })
  })

  it.each([
    ['provider', `provider = 'github'`],
    ['registry host', `registry_host = 'registry.attacker.example'`],
    ['git host', `git_host = 'git.attacker.example'`],
    ['path prefix', `path_prefix = ''`],
  ])('refuses to open a secret whose %s was changed in the database', async (_, change) => {
    const { app, deps, vault } = credentialApp()
    const { id } = storeCredential(deps.db, vault as CredentialVault)

    deps.db.prepare(`UPDATE access_credentials SET ${change} WHERE id = ?`).run(id)

    const list = await send<AccessCredentialsResponse>(app, '/api/credentials')

    expect(list.body.credentials[0]?.secretReadable).toBe(false)
    expect(openCredential(vault as CredentialVault, getCredentialRow(deps.db, id)!)).toBeNull()
    expect(await send(app, `/api/credentials/${id}/test`, 'POST', {})).toMatchObject({
      status: 409,
      body: { error: 'secret_unreadable' },
    })
  })

  it('re-seals a secret for the fields a change keeps or removes', async () => {
    const { app, deps, vault } = credentialApp()
    const { id } = storeCredential(deps.db, vault as CredentialVault)

    expect(await send(app, `/api/credentials/${id}`, 'PATCH', { label: 'Renamed' })).toMatchObject({
      status: 200,
      body: { secretReadable: true },
    })
    expect(
      await send(app, `/api/credentials/${id}`, 'PATCH', {
        uses: ['registry'],
        pathPrefix: 'acme/shop',
        repoMapping: null,
      }),
    ).toMatchObject({ status: 200, body: { secretReadable: true, gitHost: null } })
    expect(openCredential(vault as CredentialVault, getCredentialRow(deps.db, id)!)?.secret).toBe(
      GITLAB_SECRET,
    )
  })

  it('deletes a credential', async () => {
    const { app, deps, vault, logs } = credentialApp()
    const { id } = storeCredential(deps.db, vault as CredentialVault)

    expect((await send(app, `/api/credentials/${id}`, 'DELETE', {})).status).toBe(204)
    expect((await send(app, `/api/credentials/${id}`, 'DELETE', {})).status).toBe(404)
    expect(logs).toEqual([
      expect.stringContaining(`access credential deleted: by="alice" id=${id}`),
    ])
  })

  it('tests a credential, stores the outcome and answers it in the view', async () => {
    const fetch = (async () => new Response(null, { status: 401 })) as typeof globalThis.fetch
    const { app, deps, vault, logs } = credentialApp({ fetch })

    const { id } = storeCredential(deps.db, vault as CredentialVault, {
      ...GITLAB_INPUT,
      registryHost: 'registry.example.com',
      uses: ['registry'],
      pathPrefix: '',
    })
    const tested = await send(app, `/api/credentials/${id}/test`, 'POST', {})

    expect(tested.status).toBe(200)
    expect(tested.body.lastTest).toMatchObject({
      git: null,
      registry: { checked: expect.any(Number) },
    })
    expect(tested.text).not.toContain(GITLAB_SECRET)
    expect(logs.at(-1)).toMatch(/access credential tested: .* registry=0\/\d+/)
    expect(
      (await send<AccessCredentialsResponse>(app, '/api/credentials')).body.credentials[0]
        ?.lastTest,
    ).toEqual(tested.body.lastTest)
    expect((await send(app, '/api/credentials/999/test', 'POST', {})).status).toBe(404)
  })
})
