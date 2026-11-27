// @vitest-environment node
import type { DatabaseSync } from 'node:sqlite'

import { describe, expect, it } from 'vitest'

import type { WorkerResult } from '#core/check.ts'
import { checkFixture, DIGEST, NGINX, START } from '#server/checks/__tests__/checkFixtures.ts'
import { readChecks } from '#server/checks/readChecks.ts'
import { queueForUser } from '#server/checks/userCommands.ts'
import { claimForWorker, recordResult } from '#server/checks/workerCommands.ts'

const RESULT: WorkerResult = {
  status: 'done',
  error: null,
  durationMs: 1,
  usage: null,
  reply: null,
}

/**
 * Returns a digest made of one repeated hex character.
 * @param {string} hex - Hex character
 * @returns {string} - Digest
 */
const digest = (hex: string): string => `sha256:${hex.repeat(64)}`

/**
 * Adds open instances of a finding seen before the fixture's instances, older ones later.
 * @param {DatabaseSync} db - Database
 * @param {number} findingId - Finding id
 * @param {[string, string][]} tagged - Tag and digest per instance
 * @returns {void}
 */
const addInstances = (db: DatabaseSync, findingId: number, tagged: [string, string][]): void => {
  tagged.forEach(([tag, imageDigest], index) => {
    const seen = new Date(START.getTime() - 86_400_000 * (index + 2)).toISOString()

    db.prepare(
      `INSERT INTO finding_instances (finding_id, natural_key, namespace, resource_kind,
         resource_name, container, image_tag, image_digest, first_seen, last_seen)
       VALUES (?, ?, 'apps', 'Deployment', ?, 'app', ?, ?, ?, ?)`,
    ).run(findingId, `extra-${index}`, `extra-${index}`, tag, imageDigest, seen, seen)
  })
}

describe('claim images', () => {
  it('claims every distinct open digest, primary first, and names the tags beyond three', () => {
    const { context, db, findings } = checkFixture()

    addInstances(db, findings.nginx, [
      ['1.26', digest('c')],
      ['1.25', digest('d')],
      ['1.24', digest('e')],
    ])
    queueForUser(context, 'alice', [findings.nginx])

    const claim = claimForWorker(context)

    expect(claim).toMatchObject({ imageRef: `${NGINX}@${DIGEST}`, imageDigest: DIGEST })
    expect(claim?.images?.map(({ imageDigest }) => imageDigest)).toEqual([
      DIGEST,
      digest('c'),
      digest('d'),
    ])
    expect(claim?.images?.[1]).toEqual({
      imageRef: `${NGINX}@${digest('c')}`,
      imageDigest: digest('c'),
      tag: '1.26',
    })
    expect(claim?.prompt).toContain(
      `1 more tag was not pulled: 1.24 (${digest('e').slice(0, 19)}). Name it under unknowns.`,
    )
  })

  it('claims a single image without a not-pulled line for one digest', () => {
    const { context, findings } = checkFixture()

    queueForUser(context, 'alice', [findings.nginx])

    const claim = claimForWorker(context)

    expect(claim?.images).toEqual([
      { imageRef: `${NGINX}@${DIGEST}`, imageDigest: DIGEST, tag: expect.any(String) },
    ])
    expect(claim?.prompt).not.toContain('not pulled')
  })

  it('stores the reported images with their tags and reads an older result as one image', () => {
    const { context, db, findings } = checkFixture()

    addInstances(db, findings.nginx, [['1.26', digest('c')]])
    queueForUser(context, 'alice', [findings.nginx, findings.redis])

    const first = claimForWorker(context)?.checkId ?? 0

    recordResult(context, first, {
      ...RESULT,
      pulledDigest: DIGEST,
      pulledDigests: [DIGEST, digest('c')],
    })

    const second = claimForWorker(context)?.checkId ?? 0

    recordResult(context, second, { ...RESULT, pulledDigest: digest('f') })

    const recent = readChecks(context).recent

    expect(recent.find((check) => check.id === first)?.pulledImages).toEqual([
      { digest: DIGEST, tag: expect.any(String) },
      { digest: digest('c'), tag: '1.26' },
    ])
    expect(recent.find((check) => check.id === second)).toMatchObject({
      pulledDigest: digest('f'),
      pulledImages: [{ digest: digest('f'), tag: '7.4' }],
    })
  })

  it('reads a check without stored images from its pulled digest', () => {
    const { context, db, findings } = checkFixture()

    queueForUser(context, 'alice', [findings.nginx])

    const id = claimForWorker(context)?.checkId ?? 0

    recordResult(context, id, { ...RESULT, pulledDigest: DIGEST })
    expect(() => db.prepare(`UPDATE checks SET pulled_images = 'not json'`).run()).toThrow(
      /CHECK constraint failed/,
    )
    db.prepare('UPDATE checks SET pulled_images = NULL').run()

    expect(readChecks(context).recent[0]?.pulledImages).toEqual([{ digest: DIGEST, tag: null }])
  })
})
