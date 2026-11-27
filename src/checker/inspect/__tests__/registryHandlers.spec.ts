// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import type { CommandOutput, ExecCommand } from '#checker/inspect/execCommand.ts'
import { createRegistryHandlers } from '#checker/inspect/registryHandlers.ts'
import { parsePlatform, parseRegistryRef } from '#checker/inspect/registryRef.ts'

const DIGEST = `sha256:${'ab'.repeat(32)}`
const INDEX = JSON.stringify({
  mediaType: 'application/vnd.oci.image.index.v1+json',
  manifests: [
    { platform: { os: 'linux', architecture: 'amd64' } },
    { platform: { os: 'linux', architecture: 'arm', variant: 'v7' } },
    { platform: { os: 'unknown', architecture: 'unknown' } },
  ],
})
const CONFIG = JSON.stringify({
  created: '2026-11-20T08:00:00Z',
  config: {
    Labels: {
      'org.opencontainers.image.base.name': 'docker.io/library/alpine:3.22',
      maintainer: 'NGINX Docker Maintainers',
    },
  },
  history: [
    {
      created: '2026-11-10T00:00:00Z',
      created_by: 'ADD alpine-minirootfs-3.22.2-x86_64.tar.gz / # buildkit',
    },
    { created: '2026-11-20T08:00:00Z', created_by: 'RUN apk upgrade', empty_layer: false },
  ],
})

/**
 * Builds a command outcome.
 * @param {string} stdout - Output text
 * @param {Partial<CommandOutput>} rest - Fields to override
 * @returns {CommandOutput} - Outcome with exit code 0 by default
 */
const output = (stdout: string, rest: Partial<CommandOutput> = {}): CommandOutput => ({
  stdout: Buffer.from(stdout),
  stderr: '',
  code: 0,
  truncated: false,
  timedOut: false,
  ...rest,
})

/**
 * Creates a fake crane that answers by subcommand.
 * @param {Record<string, CommandOutput>} answers - Outcome by crane subcommand
 * @returns {ReturnType<typeof vi.fn<ExecCommand>>} - Fake runner
 */
const fakeCrane = (answers: Record<string, CommandOutput>) =>
  vi.fn<ExecCommand>(async (_file, args) => answers[args[0] ?? ''] ?? output('', { code: 1 }))

/**
 * Creates the handlers over a fake crane.
 * @param {ReturnType<typeof vi.fn<ExecCommand>>} exec - Fake runner
 * @returns {ReturnType<typeof createRegistryHandlers>} - Handlers
 */
const handlers = (exec: ReturnType<typeof vi.fn<ExecCommand>>) =>
  createRegistryHandlers({ root: '/work', exec, path: '/usr/bin', timeoutMs: 1000, maxBytes: 4096 })

/**
 * Returns the text of a tool result.
 * @param {{ content: unknown[] }} result - Tool result
 * @returns {string} - Text of the first block
 */
const text = (result: { content: unknown[] }): string =>
  (result.content[0] as { text: string }).text

describe('parseRegistryRef', () => {
  it('names Docker Hub and its official images explicitly', () => {
    expect(parseRegistryRef('nginx/nginx-unprivileged:1.31.8-alpine', 'required')).toEqual({
      host: 'docker.io',
      repository: 'docker.io/nginx/nginx-unprivileged',
      ref: 'docker.io/nginx/nginx-unprivileged:1.31.8-alpine',
    })
    expect(parseRegistryRef('alpine', 'none').repository).toBe('docker.io/library/alpine')
    expect(parseRegistryRef(`ghcr.io/acme/app@${DIGEST}`, 'required').ref).toBe(
      `ghcr.io/acme/app@${DIGEST}`,
    )
  })

  it.each([
    ['--registry=evil.example', 'not start with -'],
    ['10.0.0.1/app:1', 'public DNS name'],
    ['registry.svc.cluster.local/app:1', 'public DNS name'],
    ['ghcr.io:8443/app:1', 'public DNS name'],
    ['evil.example.org/leak/data:1', 'reach only'],
    ['ghcr.io/Acme/app:1', 'lower case'],
    ['ghcr.io/acme/app:bad tag', 'tag must be'],
    ['ghcr.io/acme/app@sha256:12', 'tag must be'],
    ['ghcr.io/acme/app', 'add a tag'],
    ['x'.repeat(301), '1 to 300'],
  ])('refuses %s', (ref, reason) => {
    expect(() => parseRegistryRef(ref, 'required')).toThrow(reason)
  })

  it('refuses a tag where only a repository is wanted and an odd platform', () => {
    expect(() => parseRegistryRef('nginx:1', 'none')).toThrow('leave out')
    expect(() => parsePlatform('linux/--amd64')).toThrow('os/architecture')
    expect(parsePlatform('linux/arm/v7')).toBe('linux/arm/v7')
  })
})

describe('registry tools', () => {
  it('lists tags anonymously, filtered by prefix and capped', async () => {
    const exec = fakeCrane({ ls: output('1.31.7-alpine\n1.31.8-alpine\n1.31.8\nlatest\n') })
    const result = await handlers(exec).registry_tags({
      repository: 'nginx/nginx-unprivileged',
      prefix: '1.31.',
      limit: 2,
    })

    expect(text(result)).toBe(
      '3 tags starting with 1.31. of docker.io/nginx/nginx-unprivileged in registry order, 2 shown, narrow with prefix to see the rest:\n1.31.7-alpine\n1.31.8-alpine',
    )
    expect(exec).toHaveBeenCalledWith(
      'crane',
      ['ls', '--omit-digest-tags', 'docker.io/nginx/nginx-unprivileged'],
      expect.objectContaining({
        path: '/usr/bin',
        env: { DOCKER_CONFIG: expect.stringMatching(/^\/nonexistent\//) },
      }),
    )
  })

  it('describes an image: digest, platforms, created, labels, base image and history', async () => {
    const exec = fakeCrane({
      digest: output(`${DIGEST}\n`),
      manifest: output(INDEX),
      config: output(CONFIG),
    })
    const result = await handlers(exec).registry_image({
      ref: 'nginx/nginx-unprivileged:1.31.8-alpine',
    })

    expect(JSON.parse(text(result))).toEqual({
      ref: 'docker.io/nginx/nginx-unprivileged:1.31.8-alpine',
      digest: DIGEST,
      mediaType: 'application/vnd.oci.image.index.v1+json',
      platforms: ['linux/amd64', 'linux/arm/v7'],
      config: {
        platform: 'linux/amd64',
        created: '2026-11-20T08:00:00Z',
        labels: expect.objectContaining({ maintainer: 'NGINX Docker Maintainers' }),
        baseImage: { name: 'docker.io/library/alpine:3.22', digest: null },
        history: [
          expect.objectContaining({ createdBy: expect.stringContaining('alpine-minirootfs') }),
          { created: '2026-11-20T08:00:00Z', createdBy: 'RUN apk upgrade', emptyLayer: false },
        ],
      },
    })
    expect(exec.mock.calls.map((call) => call[1])).toContainEqual([
      'config',
      '--platform',
      'linux/amd64',
      'docker.io/nginx/nginx-unprivileged:1.31.8-alpine',
    ])
  })

  it('answers refused references, private images and timeouts as tool errors without running crane twice', async () => {
    const exec = fakeCrane({
      digest: output('', { code: 1, stderr: 'GET https://ghcr.io/token: UNAUTHORIZED\n' }),
      ls: output('', { timedOut: true, code: null }),
    })
    const tools = handlers(exec)

    expect(await tools.registry_image({ ref: 'evil.example.org/x:1' })).toMatchObject({
      isError: true,
    })
    expect(exec).not.toHaveBeenCalled()
    expect(text(await tools.registry_image({ ref: 'ghcr.io/acme/private:1' }))).toContain(
      'may not be public',
    )
    expect(exec).toHaveBeenCalledTimes(1)
    expect(text(await tools.registry_tags({ repository: 'ghcr.io/acme/app' }))).toContain(
      'timed out',
    )
  })
})
