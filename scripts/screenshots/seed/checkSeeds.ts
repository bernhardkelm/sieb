import type { CheckUsage } from '#core/check.ts'
import type { CheckedSource } from '#core/privateAccess.ts'
import { REVIEW_PROPOSAL } from '#scripts/screenshots/seed/reviewProposal.ts'
import { IMAGE } from '#scripts/screenshots/seed/seedImages.ts'

export interface FinishedCheckSeed {
  vulnId: string
  imageRef: string
  status: 'done' | 'failed'
  error: string | null
  durationMs: number
  usage: CheckUsage
  reply: string
  source: CheckedSource | null
  proposal: Record<string, unknown> | null // propose_decision arguments without findingId
  accept: boolean // accepts the proposal afterwards, so it leaves the Inbox
}

const MODEL = 'claude-opus-5-5'

/**
 * Returns a usage record with plausible token counts.
 * @param {number} turns - Turns the check took
 * @param {number} costUsd - API-equivalent cost
 * @returns {CheckUsage} - Usage
 */
const usage = (turns: number, costUsd: number): CheckUsage => ({
  inputTokens: turns * 3100,
  outputTokens: turns * 260,
  cacheReadTokens: turns * 9800,
  cacheCreationTokens: turns * 700,
  costUsd,
  turns,
  models: [MODEL],
})

/**
 * Returns the finished Auto-checks in the order they ran: one failed, then four done with a
 * proposal, one of them on an own image with the source checked out at a tag. The nginx proposal
 * stays open for the review shot.
 * @returns {FinishedCheckSeed[]} - Seeds
 */
export const finishedChecks = (): FinishedCheckSeed[] => [
  {
    vulnId: 'CVE-2099-84625',
    imageRef: IMAGE.alertmanager,
    status: 'failed',
    error: 'max turns reached before a verdict',
    durationMs: 600_000,
    usage: usage(40, 1.12),
    reply: '',
    source: null,
    proposal: null,
    accept: false,
  },
  {
    vulnId: 'CVE-2099-73289',
    imageRef: IMAGE.prometheus,
    status: 'done',
    error: null,
    durationMs: 251_000,
    usage: usage(12, 0.38),
    reply: 'Proposal filed: not affected, the gRPC credential logging is never enabled.',
    source: null,
    proposal: {
      verdict: 'not_affected',
      justification: 'vulnerable_code_not_in_execute_path',
      confidence: 'high',
      summary: 'Prometheus never enables gRPC debug logging, the token leak needs it.',
      evidence: [{ check: 'grpc logging', method: 'prometheus flags', result: 'not set' }],
      evidenceBasis: ['image', 'upstream_source'],
      agent: 'Claude Code',
    },
    accept: true,
  },
  {
    vulnId: 'CVE-2099-95080',
    imageRef: IMAGE.demoApp,
    status: 'done',
    error: null,
    durationMs: 407_000,
    usage: usage(19, 0.61),
    reply: 'Proposal filed: rebuild demo-app on alpine:3.20.4.',
    source: {
      repoUrl: 'https://gitlab.example.com/acme/demo-app',
      revision: '4f9c2e1a7b3d5f60812c9e4d7a1b3c5e6f708192',
      fromLabel: true,
      refKind: 'tag',
      ref: 'v1.4.2',
    },
    proposal: {
      verdict: 'needs_patch',
      confidence: 'high',
      summary:
        'The Dockerfile builds on alpine:3.20.3, the fixed libssl3 ships with alpine:3.20.4.',
      fix: {
        action: 'base image: rebuild demo-app on alpine:3.20.4 (libssl3 3.3.3-r0)',
        layer: 'base_image',
        fixedVersion: '3.3.3-r0',
        availability: 'available',
        change: 'Change FROM alpine:3.20.3 to alpine:3.20.4 in Dockerfile, rebuild and deploy.',
        effort: 'Rebuild and deploy, about 15 minutes',
      },
      evidence: [{ check: 'base image', method: 'Dockerfile:1', result: 'FROM alpine:3.20.3' }],
      evidenceBasis: ['image', 'own_source'],
      agent: 'Claude Code',
    },
    accept: true,
  },
  {
    vulnId: 'CVE-2099-90319',
    imageRef: IMAGE.coredns,
    status: 'done',
    error: null,
    durationMs: 296_000,
    usage: usage(14, 0.44),
    reply: 'Proposal filed: needs patch at the platform, k3s v1.31.5+k3s1 ships coredns 1.12.1.',
    source: null,
    proposal: {
      verdict: 'needs_patch',
      confidence: 'high',
      summary:
        'CoreDNS 1.11.3 links the affected grpc-go, k3s v1.31.5+k3s1 bundles coredns 1.12.1.',
      fix: {
        action: 'k3s: upgrade to v1.31.5+k3s1 (coredns 1.12.1)',
        layer: 'platform',
        fixedVersion: '1.12.1',
        availability: 'available',
        change: 'Upgrade the k3s servers, then the agents, to v1.31.5+k3s1.',
        effort: 'Rolling k3s upgrade, about 30 minutes',
      },
      evidence: [{ check: 'grpc-go version', method: 'go version -m coredns', result: 'v1.64.0' }],
      evidenceBasis: ['advisory', 'image'],
      agent: 'Claude Code',
    },
    accept: true,
  },
  {
    vulnId: 'CVE-2099-91600',
    imageRef: IMAGE.nginx,
    status: 'done',
    error: null,
    durationMs: 338_000,
    usage: usage(16, 0.52),
    reply:
      'Proposal filed: needs patch, rebuild on alpine:3.20.4. Two more openssl findings share the cause.',
    source: null,
    proposal: REVIEW_PROPOSAL,
    accept: false,
  },
]
