// @vitest-environment node
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CLAIM, PULLED, testConfig } from '#checker/__tests__/checkFixtures.ts'
import { createFakeRunner, toolBehaviour, type Behaviour } from '#checker/__tests__/fakeRunner.ts'
import { tarArchive } from '#checker/__tests__/tarFixtures.ts'
import { checkLayout } from '#checker/workspace/checkLayout.ts'
import { createCheckDirs, prepareWorkspace } from '#checker/workspace/prepareWorkspace.ts'

describe('prepareWorkspace', () => {
  let workdir = ''

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'sieb-prepare-'))
  })

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true })
  })

  /**
   * Prepares the workspace of the test claim with fake tools.
   * @param {Record<string, Behaviour>} overrides - Tool behaviours to replace
   * @returns {Promise<ReturnType<typeof createFakeRunner>>} - Runner and spawned processes
   */
  const prepare = async (overrides: Record<string, Behaviour> = {}) => {
    const fake = createFakeRunner(toolBehaviour(overrides))
    const config = testConfig(workdir)
    const layout = checkLayout(workdir, 7)

    await createCheckDirs(layout)
    await prepareWorkspace(CLAIM, PULLED, layout, {
      runner: fake.runner,
      config,
      signal: new AbortController().signal,
      remainingMs: () => 60_000,
      log: () => undefined,
    })

    return fake
  }

  it('runs crane by digest, tar and syft with the platform, the check paths and no secrets', async () => {
    const { spawned } = await prepare()
    const root = join(workdir, 'check-7')
    const workspace = join(root, 'workspace')

    expect(spawned.map(({ spec }) => [spec.command, spec.args, spec.cwd])).toEqual([
      ['crane', ['config', '--platform', 'linux/amd64', PULLED.ref], workspace],
      ['crane', ['export', '--platform', 'linux/amd64', PULLED.ref, '-'], join(workspace, 'image')],
      [
        'tar',
        [
          '-x',
          '-f',
          '-',
          '-C',
          join(workspace, 'image'),
          '--no-same-owner',
          '--no-same-permissions',
        ],
        join(workspace, 'image'),
      ],
      ['syft', ['scan', 'dir:image', '-q', '-o', `json=${join(root, 'syft.json')}`], workspace],
    ])
    for (const { spec } of spawned) {
      expect(Object.keys(spec.env).sort()).toEqual([
        'HOME',
        'PATH',
        'SYFT_CHECK_FOR_APP_UPDATE',
        'TMPDIR',
      ])
      expect(spec.env.HOME).toBe(join(root, 'home'))
    }
  })

  it('writes the image config, the inventory, the MCP config with mode 600 and the settings', async () => {
    await prepare()
    const root = join(workdir, 'check-7')

    expect(await readFile(join(root, 'workspace/image-config.json'), 'utf8')).toContain('amd64')
    expect(await readFile(join(root, 'workspace/inventory.json'), 'utf8')).toContain('musl')
    expect((await stat(join(root, 'mcp.json'))).mode & 0o777).toBe(0o600)
    expect(await readFile(join(root, 'mcp.json'), 'utf8')).toContain('Bearer sieb_check_token')
    expect(JSON.parse(await readFile(join(root, 'settings.json'), 'utf8'))).toMatchObject({
      permissions: {
        defaultMode: 'dontAsk',
        allow: expect.arrayContaining(['WebFetch(domain:nvd.nist.gov)']),
      },
    })
    await expect(stat(join(root, 'syft.json'))).rejects.toThrow('ENOENT')
  })

  it('pipes the filtered export into tar', async () => {
    let received = Buffer.alloc(0)

    await prepare({
      'crane export': (proc) => {
        proc.stdout.end(
          tarArchive([
            { name: '/etc/shadow', data: 'x' },
            { name: 'ok', data: 'y' },
          ]),
        )
        proc.exit(0)
      },
      tar: (proc) => {
        proc.stdin.on('data', (chunk: Buffer) => {
          received = Buffer.concat([received, chunk])
        })
        proc.stdin.on('end', () => proc.exit(0))
      },
    })

    expect(received.toString('latin1')).toContain('ok')
    expect(received.toString('latin1')).not.toContain('shadow')
  })

  it('fails with a short reason when the pull fails or the export is too large', async () => {
    const pull = prepare({
      'crane config': (proc) => {
        proc.stderr.write('Error: GET https://index.docker.io/v2/: UNAUTHORIZED\n')
        proc.exit(1)
      },
    })

    await expect(pull).rejects.toThrow(
      'image pull failed: Error: GET https://index.docker.io/v2/: UNAUTHORIZED',
    )

    const large = prepare({
      'crane export': (proc) => {
        proc.stdout.write(tarArchive([{ name: 'big', data: 'x'.repeat(2 * 1024 * 1024) }]))
        proc.exit(0)
      },
    })

    await expect(large).rejects.toThrow('image export exceeds 1 MiB')
  })

  it('refuses an image config above its cap instead of writing cut JSON', async () => {
    const config = prepare({
      'crane config': (proc) => {
        proc.stdout.write('x'.repeat(5 * 1024 * 1024))
        proc.exit(0)
      },
    })

    await expect(config).rejects.toThrow('image config exceeds 4194304 bytes')
  })

  it('names a broken tar stream instead of a pull failure once the worker killed crane', async () => {
    const garbage = prepare({
      'crane export': (proc) => {
        proc.stdout.write(Buffer.alloc(1024, 0x41))
      },
    })

    await expect(garbage).rejects.toThrow(
      'image export is not a valid tar stream: invalid numeric header field',
    )
  })

  it('names a tar failure when tar dies during extraction', async () => {
    const full = prepare({
      tar: (proc) => {
        proc.stderr.write('tar: ok: Cannot write: No space left on device\n')
        proc.stdin.destroy()
        proc.exit(2)
      },
    })

    await expect(full).rejects.toThrow(
      'image extraction failed: tar: ok: Cannot write: No space left on device',
    )
  })

  it('keeps the error code at the end of a long crane error line', async () => {
    const pull = prepare({
      'crane config': (proc) => {
        proc.stderr.write(
          `Error: fetching manifest ${'docker.io/library/nginx'.repeat(10)}: GET https://index.docker.io/v2/library/nginx/manifests/nope: MANIFEST_UNKNOWN: manifest unknown; unknown tag=nope\n`,
        )
        proc.exit(1)
      },
    })

    await expect(pull).rejects.toThrow(
      /^image pull failed: Error: fetching manifest .* \.\.\. .*MANIFEST_UNKNOWN: manifest unknown; unknown tag=nope$/,
    )
  })

  it('leaves a note instead of failing when syft fails', async () => {
    await prepare({
      syft: (proc) => {
        proc.stderr.write('could not catalog\n')
        proc.exit(1)
      },
    })

    expect(await readFile(join(workdir, 'check-7/workspace/inventory.json'), 'utf8')).toBe(
      '{"error":"syft failed: could not catalog"}',
    )
  })
})
