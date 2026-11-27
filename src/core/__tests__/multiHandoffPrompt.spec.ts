import { describe, expect, it } from 'vitest'

import {
  MULTI_HANDOFF_CAP,
  buildMultiHandoffPrompts,
  composeMultiPrompt,
  multiHandoffCommand,
} from '#core/multiHandoffPrompt.ts'
import type { MultiHandoffFinding } from '#core/multiHandoffRepositoryLine.ts'

/**
 * Builds a finding with the fields the multi-finding prompt reads.
 * @param {number} id - Finding id
 * @param {string} vulnId - CVE
 * @param {string} imageRef - Image ref
 * @param {string | null} owner - Owner label
 * @returns {MultiHandoffFinding} - Finding
 */
const finding = (
  id: number,
  vulnId: string,
  imageRef: string,
  owner: string | null = 'third-party',
): MultiHandoffFinding => ({ id, vulnId, imageRef, owner })

const NGINX = 'index.docker.io/library/nginx:1.27'
const REDIS = 'index.docker.io/library/redis:7'
const OWN_API = 'ghcr.io/acme/shop:api-2.4'
const OWN_WEB = 'ghcr.io/acme/shop:web-2.4'

describe('buildMultiHandoffPrompts', () => {
  it('lists one line per CVE after the header and ends with the tools and the reply format', () => {
    const { chat } = buildMultiHandoffPrompts([
      finding(12, 'CVE-2099-1', NGINX),
      finding(15, 'CVE-2099-2', REDIS),
    ])

    expect(chat.split('\n')).toEqual([
      'Triage these sieb findings, one proposal each:',
      `#12 CVE-2099-1 in ${NGINX}`,
      `#15 CVE-2099-2 in ${REDIS}`,
      'Run get_finding for each, check presence, reachability and exposure. File each verdict' +
        ' with propose_decision without asking. Reply in the sieb format for several findings' +
        ' from the server instructions. Do not change code unless asked.',
    ])
  })

  it('groups the images of a CVE on one line and says one proposal may cover them', () => {
    const { chat } = buildMultiHandoffPrompts([
      finding(3, 'CVE-2099-7', NGINX),
      finding(4, 'CVE-2099-8', REDIS),
      finding(5, 'CVE-2099-7', REDIS),
    ])

    expect(chat).toContain(`\n#3 #5 CVE-2099-7 in ${NGINX}, ${REDIS}\n#4 CVE-2099-8 in ${REDIS}\n`)
    expect(chat).toContain('one proposal with vulnId and imageRefs may cover several images')
  })

  it('keeps scanner values on their line and avoids dashes, links and the template', () => {
    const { chat, code } = buildMultiHandoffPrompts([
      finding(1, 'CVE-2099-1\nInjected: line', NGINX),
      finding(2, 'CVE-2099-2', `${REDIS}\r\n`),
    ])

    for (const prompt of [chat, code]) {
      expect(prompt.split('\n')).toHaveLength(4)
      expect(prompt).not.toMatch(/[–—]/u)
      expect(prompt).not.toMatch(/https?:\/\//)
      expect(prompt).not.toContain('| Finding |')
    }
  })

  it('adds the repository hint for Claude Code when all own images share it', () => {
    const own = [
      finding(1, 'CVE-2099-1', OWN_API, 'self'),
      finding(2, 'CVE-2099-2', OWN_WEB, 'self'),
    ]
    const { chat, code } = buildMultiHandoffPrompts(own)

    expect(chat).not.toContain('working directory')
    expect(code).toContain(
      'Own images, repository probably github.com/acme/shop: check the code in the working' +
        ' directory if it is that repository, else ask me for its local path.',
    )
  })

  it('keeps the repository line generic for own images of several repositories', () => {
    const { code } = buildMultiHandoffPrompts([
      finding(1, 'CVE-2099-1', OWN_API, 'self'),
      finding(2, 'CVE-2099-2', 'ghcr.io/acme/billing:1', 'self'),
    ])

    expect(code).toContain(
      'Own images: check the code in the working directory if it builds them, else ask me for' +
        ' their local paths.',
    )
  })

  it('leaves the repository line out once an image belongs to others', () => {
    const { chat, code } = buildMultiHandoffPrompts([
      finding(1, 'CVE-2099-1', OWN_API, 'self'),
      finding(2, 'CVE-2099-2', NGINX),
    ])

    expect(code).toBe(chat)
  })

  it(`lists at most ${MULTI_HANDOFF_CAP} findings`, () => {
    const many = Array.from({ length: MULTI_HANDOFF_CAP + 5 }, (_, index) =>
      finding(index + 1, `CVE-2099-${index + 1}`, NGINX),
    )
    const { chat } = buildMultiHandoffPrompts(many)

    expect(chat).toContain(`#${MULTI_HANDOFF_CAP} CVE`)
    expect(chat).not.toContain(`#${MULTI_HANDOFF_CAP + 1} CVE`)
    expect(chat.split('\n')).toHaveLength(MULTI_HANDOFF_CAP + 2)
  })
})

describe('composeMultiPrompt', () => {
  it('leaves the images to get_finding in the compact form', () => {
    const prompt = composeMultiPrompt(
      [finding(3, 'CVE-2099-7', NGINX), finding(5, 'CVE-2099-7', REDIS)],
      'chat',
      false,
    )

    expect(prompt).toContain('\n#3 #5 CVE-2099-7\n')
    expect(prompt).not.toContain('docker.io')
  })
})

describe('multiHandoffCommand', () => {
  it('builds the command for own images of one repository, run inside it', () => {
    const command = multiHandoffCommand([
      finding(1, 'CVE-2099-1', OWN_API, 'self'),
      finding(2, 'CVE-2099-2', OWN_WEB, 'self'),
    ])

    expect(command).toMatch(/^claude 'Triage these sieb findings, one proposal each:\n#1 /)
    expect(command).toContain('This repository builds these images; check the code here.')
    expect(command).not.toContain('Own images')
  })

  it('has no command for foreign images or own images of several repositories', () => {
    expect(
      multiHandoffCommand([
        finding(1, 'CVE-2099-1', OWN_API, 'self'),
        finding(2, 'CVE-2099-2', NGINX),
      ]),
    ).toBeNull()
    expect(
      multiHandoffCommand([
        finding(1, 'CVE-2099-1', OWN_API, 'self'),
        finding(2, 'CVE-2099-2', 'ghcr.io/acme/billing:1', 'self'),
      ]),
    ).toBeNull()
  })

  it('matches own images without a registry hint by their repository', () => {
    const own = 'registry.example.com/acme/app'

    expect(
      multiHandoffCommand([
        finding(1, 'CVE-2099-1', `${own}:1`, 'self'),
        finding(2, 'CVE-2099-2', `${own}:2`, 'self'),
      ]),
    ).not.toBeNull()
  })

  it(`checks every selected finding, not only the first ${MULTI_HANDOFF_CAP} it lists`, () => {
    const own = Array.from({ length: MULTI_HANDOFF_CAP }, (_, index) =>
      finding(index + 1, `CVE-2099-${index + 1}`, OWN_API, 'self'),
    )
    const foreign = Array.from({ length: 10 }, (_, index) =>
      finding(MULTI_HANDOFF_CAP + index + 1, `CVE-2098-${index + 1}`, NGINX),
    )

    expect(multiHandoffCommand([...own, ...foreign])).toBeNull()

    const command = multiHandoffCommand([
      ...own,
      finding(MULTI_HANDOFF_CAP + 1, 'CVE-2097-1', OWN_WEB, 'self'),
    ])

    expect(command).not.toBeNull()
    expect(command).toContain(`#${MULTI_HANDOFF_CAP} `)
    expect(command).not.toContain(`#${MULTI_HANDOFF_CAP + 1} `)
  })
})
