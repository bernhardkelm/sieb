import type { DatabaseSync } from 'node:sqlite'

import type { AccessScope } from '#core/accessScope.ts'
import { ADDRESS_NOT_ALLOWED, DENIED_REASONS } from '#core/accessTestVerdict.ts'
import type {
  AccessProvider,
  AccessTestFailure,
  AccessTestPart,
  AccessTestResult,
} from '#core/privateAccess.ts'
import type { CredentialLogin } from '#server/credentials/credentialLogin.ts'
import { gitTestTargets, registryTestTargets } from '#server/credentials/credentialTestTargets.ts'
import { probeGit } from '#server/credentials/probe/gitProbe.ts'
import {
  DEFAULT_PROBE_TIMINGS,
  type ProbeOptions,
  type ProbeOutcome,
  type ProbeTimings,
} from '#server/credentials/probe/probeFetch.ts'
import { createProbeFetch } from '#server/credentials/probe/probeHttps.ts'
import { probeRegistry } from '#server/credentials/probe/registryProbe.ts'

export const MAX_TEST_FAILURES = 5
const CONCURRENCY = 4

/** What a credential test needs besides the database */
export interface CredentialTestInput {
  scope: AccessScope // credential under test
  provider: AccessProvider // its provider, which decides the trusted token realms
  scopes: readonly AccessScope[] // all credentials, for their repository mappings
  login: CredentialLogin
  fetch?: typeof globalThis.fetch // replaced in tests, else the vetted probe fetch
  timings?: ProbeTimings
  now: Date
}

/**
 * Probes targets a few at a time and sums the outcomes, keeping the first MAX_TEST_FAILURES
 * failures and counting the refused logins and refused addresses over all of them.
 * @param {readonly T[]} targets - Targets in order
 * @param {(target: T) => Promise<ProbeOutcome>} probe - Probes one target
 * @param {(target: T) => string} nameOf - Target name for a failure
 * @returns {Promise<AccessTestPart>} - Checked, ok and failures
 */
const probeAll = async <T>(
  targets: readonly T[],
  probe: (target: T) => Promise<ProbeOutcome>,
  nameOf: (target: T) => string,
): Promise<AccessTestPart> => {
  const outcomes: ProbeOutcome[] = Array.from({ length: targets.length }, () => null)
  let next = 0

  /**
   * Probes the next unclaimed target until none is left.
   * @returns {Promise<void>}
   */
  const lane = async (): Promise<void> => {
    for (let index = next++; index < targets.length; index = next++) {
      outcomes[index] = await probe(targets[index] as T)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, lane))

  const failures: AccessTestFailure[] = outcomes.flatMap((reason, index) =>
    reason === null ? [] : [{ target: nameOf(targets[index] as T), reason }],
  )

  return {
    checked: targets.length,
    ok: targets.length - failures.length,
    failures: failures.slice(0, MAX_TEST_FAILURES),
    denied: failures.filter((failure) => DENIED_REASONS.includes(failure.reason)).length,
    blocked: failures.filter((failure) => failure.reason === ADDRESS_NOT_ALLOWED).length,
  }
}

/**
 * Tests a credential over HTTPS against what sieb knows it covers: the manifests of up to 20
 * covered images of sieb's findings, and the refs of up to 20 covered repositories. Requests
 * go only to public addresses on port 443 or a port of the credential's hosts, never follow
 * redirects and stop at the request and test time limits.
 * @param {DatabaseSync} db - Open database
 * @param {CredentialTestInput} input - Credential, its login, fetch and limits
 * @returns {Promise<AccessTestResult>} - Outcome per use, null for a use the credential lacks
 */
export const runCredentialTest = async (
  db: DatabaseSync,
  input: CredentialTestInput,
): Promise<AccessTestResult> => {
  const { scope, scopes, login, timings = DEFAULT_PROBE_TIMINGS, now } = input
  const hosts = [scope.registryHost, scope.gitHost].filter((host) => host !== null)
  const ports = hosts.flatMap((host) => /:(\d+)$/u.exec(host)?.slice(1).map(Number) ?? [])
  const options: ProbeOptions = {
    fetch: input.fetch ?? createProbeFetch({ ports }),
    signal: AbortSignal.timeout(timings.totalMs),
    requestMs: timings.requestMs,
  }
  const registry = scope.uses.includes('registry')
    ? await probeAll(
        registryTestTargets(db, scope),
        (target) => probeRegistry(options, target, login, { provider: input.provider, hosts }),
        (target) => target.imageRef,
      )
    : null
  const git = scope.uses.includes('git')
    ? await probeAll(
        gitTestTargets(db, scope, scopes),
        (repository) => probeGit(options, repository, login),
        (repository) => repository.repoUrl,
      )
    : null

  return { at: now.toISOString(), registry, git }
}
