// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { CLAIM, PULLED, WORKSPACE } from '#checker/__tests__/checkFixtures.ts'
import { workspacePrompt } from '#checker/claude/workspacePrompt.ts'

const SECOND = {
  ref: `docker.io/library/nginx@sha256:${'b'.repeat(64)}`,
  digest: `sha256:${'b'.repeat(64)}`,
  scanned: true,
  tag: '1.26-alpine',
  claimRef: `docker.io/library/nginx@sha256:${'b'.repeat(64)}`,
}

describe('workspacePrompt', () => {
  it('appends the per-image layout and the pulled digest to the sieb prompt', () => {
    const prompt = workspacePrompt(CLAIM, 'linux/amd64', WORKSPACE)

    expect(prompt.startsWith(CLAIM.prompt)).toBe(true)
    expect(prompt).toContain('one directory per pulled image of the finding, images/<n>-<tag>/')
    expect(prompt).toContain('- rootfs/: the flattened filesystem of the image (linux/amd64)')
    expect(prompt).toContain('- inventory.json: the syft package inventory of rootfs/')
    expect(prompt).toContain(
      `- images/1-1.27/: ${PULLED.ref}, the digest docker.io/library/nginx:1.27 pointed to at check time. The digest of the scanned image is unknown`,
    )
    expect(
      workspacePrompt(CLAIM, 'linux/amd64', {
        prepared: [{ ...PULLED, scanned: true, dir: 'images/1-1.27' }],
        skipped: [],
      }),
    ).toContain(`- images/1-1.27/: ${PULLED.ref}, the digest of the scanned image`)
    expect(prompt).not.toContain('not pulled:')
  })

  it('lists every pulled image, the skipped ones and asks for results per image', () => {
    const prompt = workspacePrompt(CLAIM, 'linux/amd64', {
      prepared: [
        { ...PULLED, scanned: true, dir: 'images/1-1.27' },
        { ...SECOND, dir: 'images/2-1.26-alpine' },
      ],
      skipped: [
        {
          image: { ...SECOND, ref: 'docker.io/library/nginx@sha256:cc', tag: '1.25' },
          reason: 'size',
        },
        {
          image: { ...SECOND, ref: 'docker.io/library/nginx@sha256:dd', tag: '1.24' },
          reason: 'pull',
        },
      ],
    })

    expect(prompt).toContain(
      `- images/2-1.26-alpine/: ${SECOND.ref}, the digest of the scanned image`,
    )
    expect(prompt).toContain(
      '- not pulled: docker.io/library/nginx@sha256:cc, it would pass the size cap',
    )
    expect(prompt).toContain('- not pulled: docker.io/library/nginx@sha256:dd, its pull failed')
    expect(prompt).toContain(
      'Check every pulled image; when the results differ, state the result per image',
    )
    expect(prompt).toContain('A tag that was not pulled goes under unknowns.')
  })

  it('keeps the investigation rules', () => {
    const prompt = workspacePrompt(CLAIM, 'linux/amd64', WORKSPACE)

    expect(prompt).toContain(
      "NVD's HTML pages need JavaScript and come back empty; read NVD through its API, https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=<CVE>, or use the GitHub advisory and OSV.",
    )
    expect(prompt).toContain('name own_source and runtime under Not checked')
    expect(prompt).toContain('There is no shell.')
    expect(prompt).toContain('the inspect tools (strings, readelf, objdump, unzip_list, jq)')
    expect(prompt).toContain(
      'File the verdict with propose_decision, then reply in the sieb format.',
    )
    expect(prompt).toContain('Its evidence gets one entry per check you ran here')
    expect(prompt).toContain('also for checks that found nothing')
    expect(prompt).toContain('Its references are the advisory and fix pages you fetched.')
    expect(prompt).toContain('check before something becomes an unknown')
    expect(prompt).toContain('Unknowns are only what this workspace cannot show')
    expect(prompt).toContain('try another allowed source for the same fact')
    expect(prompt).toContain('under missing with the verdict inconclusive')
    expect(prompt).toContain('let fix.change cover both cases')
    expect(prompt).toContain('WebSearch only finds pages.')
    expect(prompt).toContain('A search summary is not a source')
    expect(prompt).toContain('until you can name the first release that ships the fix')
    expect(prompt).toContain('is your work, not a step in fix.action or fix.change')
    expect(prompt).toContain('is a skipped check, not an unknown')
    expect(prompt).toContain(
      'get_image lists the other open findings of this image; one that shares this root cause,' +
        ' checked against its own CVE and version, goes into relatedFindings',
    )
  })
})
