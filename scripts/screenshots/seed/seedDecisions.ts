import type { DecisionRequest } from '#core/decisionApiTypes.ts'
import { IMAGE } from '#scripts/screenshots/seed/seedImages.ts'
import type { SiebApi } from '#scripts/screenshots/seed/siebApi.ts'

const DAY_MS = 86_400_000

interface DecisionSeed {
  request: DecisionRequest
  byOther: boolean
}

/**
 * Returns an ISO date-time a number of days from now.
 * @param {number} days - Days ahead
 * @returns {string} - ISO date-time
 */
export const inDays = (days: number): string => new Date(Date.now() + days * DAY_MS).toISOString()

/**
 * Returns the decisions taken before the second mock sync: the nginx one re-opens when the
 * severity rises, the postgres one when the CVE becomes KEV listed, two expire within 14 days
 * and one waits for an upstream release.
 * @returns {DecisionSeed[]} - Seeds
 */
const decisionSeeds = (): DecisionSeed[] => [
  {
    request: {
      vulnId: 'CVE-2099-94125',
      scope: 'image',
      imageRef: IMAGE.nginx,
      status: 'not_affected',
      justification: 'vulnerable_code_not_in_execute_path',
      reason:
        'nginx terminates TLS with ECDSA and RSA certificates only, DSA keys are never checked.',
      expiresAt: null,
    },
    byOther: false,
  },
  {
    request: {
      vulnId: 'CVE-2099-34648',
      scope: 'image',
      imageRef: IMAGE.postgres,
      status: 'accepted',
      reason:
        'Only reachable from the cluster network, the database never parses client certificates.',
      expiresAt: inDays(90),
    },
    byOther: true,
  },
  {
    request: {
      vulnId: 'CVE-2099-90253',
      scope: 'image',
      imageRef: IMAGE.redis,
      status: 'accepted',
      reason: 'Redis never calls iconv. Revisit once the 7.4 alpine image ships the fixed musl.',
      expiresAt: inDays(4),
    },
    byOther: false,
  },
  {
    request: {
      vulnId: 'CVE-2099-63485',
      scope: 'image',
      imageRef: IMAGE.mariadb,
      status: 'accepted',
      reason:
        'Reachable from the cluster network only, the upgrade to mariadb 11.4.4 is scheduled.',
      expiresAt: inDays(9),
    },
    byOther: true,
  },
  {
    request: {
      vulnId: 'CVE-2099-77133',
      scope: 'image',
      imageRef: IMAGE.traefik,
      status: 'fix_planned',
      reason:
        'Traefik ships with k3s, the fixed Go toolchain arrives with the next k3s patch release.',
      expiresAt: inDays(30),
      upstreamPending: true,
      waitingFor: 'k3s release bundling traefik 3.1.5 or later',
    },
    byOther: false,
  },
  {
    request: {
      vulnId: 'CVE-2099-92149',
      scope: 'all',
      imageRef: null,
      status: 'not_affected',
      justification: 'vulnerable_code_not_in_execute_path',
      reason: 'No workload runs awk, the BusyBox applets only serve the entrypoint scripts.',
      expiresAt: null,
    },
    byOther: false,
  },
  {
    request: {
      vulnId: 'CVE-2099-88199',
      scope: 'image',
      imageRef: IMAGE.postgres,
      status: 'accepted',
      reason: 'GSSAPI authentication is disabled in pg_hba.conf.',
      expiresAt: null,
    },
    byOther: true,
  },
  {
    request: {
      vulnId: 'CVE-2099-34280',
      scope: 'image',
      imageRef: IMAGE.grafana,
      status: 'not_affected',
      justification: 'vulnerable_code_cannot_be_controlled_by_adversary',
      reason: 'Grafana runs without an outbound proxy, the proxy settings are not user controlled.',
      expiresAt: null,
    },
    byOther: false,
  },
]

/**
 * Takes the seed decisions through the API, some of them as the second user.
 * @param {SiebApi} api - Seed client
 * @param {string} otherUser - Second user
 * @returns {Promise<void>} - Resolves once all are stored
 */
export const seedDecisions = async (api: SiebApi, otherUser: string): Promise<void> => {
  for (const { request, byOther } of decisionSeeds()) {
    await api.request('POST', '/api/decisions', request, byOther ? otherUser : undefined)
  }
}
