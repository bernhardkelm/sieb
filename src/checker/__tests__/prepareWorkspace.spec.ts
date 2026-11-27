// @vitest-environment node
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CLAIM, PULLED, testConfig } from '#checker/__tests__/checkFixtures.ts'
import {
  createFakeRunner,
  toolBehaviour,
  type Behaviour,
  type FakeProcess,
} from '#checker/__tests__/fakeRunner.ts'
import { tarArchive } from '#checker/__tests__/tarFixtures.ts'
import { checkLayout } from '#checker/workspace/checkLayout.ts'
import { createCheckDirs, prepareWorkspace } from '#checker/workspace/prepareWorkspace.ts'
import type { PulledImage } from '#checker/workspace/resolveImage.ts'

const SECOND: PulledImage = {
  ref: `docker.io/library/nginx@sha256:${'b'.repeat(64)}`,
  digest: `sha256:${'b'.repeat(64)}`,
  scanned: true,
  tag: '1.26-alpine',
  claimRef: `docker.io/library/nginx@sha256:${'b'.repeat(64)}`,
}

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
   * @param {PulledImage[]} images - Images to prepare
   * @returns {Promise<object>} - Runner, spawned processes and the prepared and skipped images
   */
  const prepare = async (overrides: Record<string, Behaviour> = {}, images = [PULLED]) => {
    const fake = createFakeRunner(toolBehaviour(overrides))
    const config = testConfig(workdir)
    const layout = checkLayout(workdir, 7)

    await createCheckDirs(layout)

    const result = await prepareWorkspace(CLAIM, images, layout, {
      runner: fake.runner,
      config,
      signal: new AbortController().signal,
      remainingMs: () => 60_000,
      log: () => undefined,
    })

    return { ...fake, result }
  }

  it('runs crane by digest, tar and syft with the platform, the check paths and no secrets', async () => {
    const { spawned } = await prepare()
    const root = join(workdir, 'check-7')
    const workspace = join(root, 'workspace')
    const rootfs = join(workspace, 'images/1-1.27/rootfs')

    expect(spawned.map(({ spec }) => [spec.command, spec.args, spec.cwd])).toEqual([
      ['crane', ['config', '--platform', 'linux/amd64', PULLED.ref], workspace],
      ['crane', ['export', '--platform', 'linux/amd64', PULLED.ref, '-'], rootfs],
      ['tar', ['-x', '-f', '-', '-C', rootfs, '--no-same-owner', '--no-same-permissions'], rootfs],
      [
        'syft',
        ['scan', 'dir:images/1-1.27/rootfs', '-q', '-o', `json=${join(root, 'syft.json')}`],
        workspace,
      ],
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

    expect(
      await readFile(join(root, 'workspace/images/1-1.27/image-config.json'), 'utf8'),
    ).toContain('amd64')
    expect(await readFile(join(root, 'workspace/images/1-1.27/inventory.json'), 'utf8')).toContain(
      'musl',
    )
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

    expect(
      await readFile(join(workdir, 'check-7/workspace/images/1-1.27/inventory.json'), 'utf8'),
    ).toBe('{"error":"syft failed: could not catalog"}')
  })

  it('fills one directory per image and returns them in claim order', async () => {
    const { spawned, result } = await prepare({}, [PULLED, SECOND])
    const workspace = join(workdir, 'check-7/workspace')

    expect(await readdir(join(workspace, 'images'))).toEqual(['1-1.27', '2-1.26-alpine'])
    expect((await stat(join(workspace, 'images/2-1.26-alpine/rootfs'))).isDirectory()).toBe(true)
    expect(
      await readFile(join(workspace, 'images/2-1.26-alpine/inventory.json'), 'utf8'),
    ).toContain('musl')
    expect(
      spawned.filter(({ spec }) => spec.args[0] === 'export').map(({ spec }) => spec.args[3]),
    ).toEqual([PULLED.ref, SECOND.ref])
    expect(result).toEqual({
      prepared: [
        { ...PULLED, dir: 'images/1-1.27' },
        { ...SECOND, dir: 'images/2-1.26-alpine' },
      ],
      skipped: [],
    })
  })

  it('applies the size cap to all images and skips an extra image that does not fit', async () => {
    const half = tarArchive([{ name: 'half', data: 'x'.repeat(600 * 1024) }])
    const { result } = await prepare(
      {
        'crane export': (proc) => {
          proc.stdout.write(half)
          proc.exit(0)
        },
      },
      [PULLED, SECOND],
    )

    expect(result.prepared.map(({ digest }) => digest)).toEqual([PULLED.digest])
    expect(result.skipped).toEqual([{ image: SECOND, reason: 'size' }])
    expect(await readdir(join(workdir, 'check-7/workspace/images'))).toEqual(['1-1.27'])
  })

  it('skips an extra image whose pull fails but fails the check for the primary one', async () => {
    /**
     * Fails crane config for the second image only.
     * @param {FakeProcess} proc - Fake crane process
     * @returns {void}
     */
    const failSecond = (proc: FakeProcess): void => {
      if (proc.spec.args.includes(SECOND.ref)) {
        proc.stderr.write('MANIFEST_UNKNOWN\n')
        proc.exit(1)
      } else {
        proc.stdout.write('{}')
        proc.exit(0)
      }
    }
    const { result } = await prepare({ 'crane config': failSecond }, [PULLED, SECOND])

    expect(result.skipped).toEqual([{ image: SECOND, reason: 'pull' }])
    await expect(prepare({ 'crane config': failSecond }, [SECOND, PULLED])).rejects.toThrow(
      'image pull failed: MANIFEST_UNKNOWN',
    )
  })
})
