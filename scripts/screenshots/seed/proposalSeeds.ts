import { IMAGE, type FindingLookup } from '#scripts/screenshots/seed/seedImages.ts'
import type { McpClient } from '#scripts/screenshots/seed/siebApi.ts'

export interface ProposalSeed {
  client: McpClient
  args: Record<string, unknown>
}

export const CLAUDE_APP: McpClient = { name: 'anthropic/claudeai', userAgent: 'Claude-User' }
export const CLAUDE_CODE: McpClient = { name: 'claude-code', userAgent: 'claude-code/2.1.4 (cli)' }
export const CLAUDE_VSCODE: McpClient = {
  name: 'claude-code',
  userAgent: 'claude-code/2.1.4 (claude-vscode)',
}

/**
 * Returns the YYYY-MM-DD date a number of days from now.
 * @param {number} days - Days ahead
 * @returns {string} - Date
 */
export const dateIn = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

/** Decision the second user takes after the outdated proposal was filed */
export const OUTDATING_DECISION = {
  vulnId: 'CVE-2099-82074',
  scope: 'image',
  imageRef: IMAGE.nginx,
  status: 'fix_planned',
  reason: 'curl leaves the image, the healthcheck moves to an httpGet probe.',
  expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
} as const

/**
 * Returns the proposal the second user overtakes with a decision of their own, which marks it
 * outdated.
 * @param {FindingLookup} id - Finding lookup
 * @returns {ProposalSeed} - Seed
 */
export const outdatedProposal = (id: FindingLookup): ProposalSeed => ({
  client: CLAUDE_APP,
  args: {
    findingId: id(OUTDATING_DECISION.vulnId, OUTDATING_DECISION.imageRef),
    verdict: 'accepted',
    confidence: 'medium',
    summary:
      'curl only serves the container healthcheck against localhost, its ASN.1 parser never sees a remote certificate.',
    exposure: 'Public storefront ingress, curl itself is never reachable from outside.',
    evidence: [
      {
        check: 'curl callers',
        method: 'HEALTHCHECK of the image config',
        result: 'curl -f http://127.0.0.1/',
      },
      {
        check: 'fixed release',
        method: 'Alpine secdb for v3.20',
        result: 'no fixed curl published yet',
      },
    ],
    evidenceBasis: ['advisory', 'image'],
    references: ['https://osv.dev/vulnerability/CVE-2099-82074'],
    agent: 'Claude',
  },
})

/**
 * Returns the open proposals of Claude clients filed after the second mock sync: not affected,
 * waiting for upstream and could not determine.
 * @param {FindingLookup} id - Finding lookup
 * @returns {ProposalSeed[]} - Seeds
 */
export const clientProposals = (id: FindingLookup): ProposalSeed[] => [
  {
    client: CLAUDE_APP,
    args: {
      findingId: id('CVE-2099-77779', IMAGE.grafana),
      verdict: 'not_affected',
      justification: 'vulnerable_code_not_in_execute_path',
      confidence: 'medium',
      summary:
        'Grafana uses golang-jwt only for the JWT auth provider, which is switched off in this deployment.',
      presence: 'github.com/golang-jwt/jwt/v4 4.5.0 is linked into the grafana binary.',
      reachability: 'The vulnerable header parsing runs only when auth.jwt is enabled.',
      evidence: [
        {
          check: 'auth.jwt',
          method: 'grafana.ini of the observability release',
          result: 'enabled = false',
        },
        { check: 'other callers', method: 'grafana source, pkg/services/auth', result: 'no match' },
      ],
      evidenceBasis: ['advisory', 'upstream_source'],
      references: [
        'https://osv.dev/vulnerability/CVE-2099-77779',
        'https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/jwt/',
      ],
      agent: 'Claude',
    },
  },
  {
    client: CLAUDE_CODE,
    args: {
      findingId: id('CVE-2099-84625', IMAGE.traefik),
      verdict: 'fix_planned',
      confidence: 'high',
      summary:
        'Traefik is built with an affected Go toolchain. k3s has not yet released a traefik built with the fix.',
      fix: {
        action: 'k3s: upgrade once a release bundles traefik 3.1.6',
        layer: 'platform',
        availability: 'upstream_pending',
        waitingFor: 'k3s release bundling traefik 3.1.6 or later',
        interim: {
          action: 'Keep the traefik dashboard entrypoint off the public load balancer',
          steps: 'Set ports.traefik.expose.default to false in the traefik HelmChartConfig.',
          caveats:
            'The dashboard is then reachable through kubectl port-forward only. Revert after the k3s upgrade.',
        },
      },
      review: { date: dateIn(14), why: 'next k3s patch release' },
      evidence: [
        { check: 'Go version', method: 'go version -m on the traefik binary', result: 'go1.23.2' },
        {
          check: 'k3s releases',
          method: 'github.com/k3s-io/k3s/releases',
          result: 'latest bundles traefik 3.1.4',
        },
      ],
      evidenceBasis: ['advisory', 'image'],
      references: ['https://github.com/k3s-io/k3s/releases'],
      agent: 'Claude Code',
    },
  },
  {
    client: CLAUDE_VSCODE,
    args: {
      findingId: id('CVE-2099-55414', IMAGE.demoWorker),
      verdict: 'inconclusive',
      confidence: 'low',
      summary:
        'Could not tell whether demo-worker ever loads DSA keys: the image is private and its source was not reachable.',
      missing: [
        'pull access to registry.example.com/acme/demo-worker',
        'the repository that builds demo-worker',
      ],
      evidence: [{ check: 'advisory', method: 'osv.dev', result: 'affects DSA key checks only' }],
      evidenceBasis: ['advisory'],
      references: ['https://osv.dev/vulnerability/CVE-2099-55414'],
      agent: 'Claude Code',
    },
  },
]
