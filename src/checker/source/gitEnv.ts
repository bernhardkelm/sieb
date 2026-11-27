import { basicAuth } from '#checker/fetcher/basicAuth.ts'

/** The repository of a fetch with its login, both login parts null for an anonymous fetch */
export interface GitAuth {
  repoUrl: string
  username: string | null
  secret: string | null
}

/** What every git run gets */
export interface GitBase {
  PATH: string
  HOME: string
  TMPDIR: string
}

// https only, no redirects to another host, no helpers, hooks, submodules or background work,
// received objects checked, symlinks and paths unsafe on other filesystems never written
const GIT_SETTINGS: [string, string][] = [
  ['protocol.allow', 'never'],
  ['protocol.https.allow', 'always'],
  ['http.followRedirects', 'false'],
  ['http.sslVerify', 'true'],
  ['credential.helper', ''],
  ['core.hooksPath', '/dev/null'],
  ['core.fsmonitor', 'false'],
  ['core.symlinks', 'false'],
  ['core.protectNTFS', 'true'],
  ['core.protectHFS', 'true'],
  ['transfer.fsckObjects', 'true'],
  ['fetch.fsckObjects', 'true'],
  ['submodule.recurse', 'false'],
  ['fetch.recurseSubmodules', 'false'],
  ['gc.auto', '0'],
  ['maintenance.auto', 'false'],
  ['advice.detachedHead', 'false'],
  ['init.defaultBranch', 'main'],
]

/**
 * Builds the environment of a git run from scratch: no system or global config, no prompts,
 * the settings above as GIT_CONFIG_* variables and, for a fetch with a login, the login as an
 * http.<url>.extraHeader of that repository only. The login is thereby neither on the command
 * line nor in a file; only processes of the fetcher's own user can read the environment. An
 * anonymous fetch gets no Authorization header at all.
 * @param {GitBase} base - PATH, HOME and TMPDIR
 * @param {GitAuth | null} auth - Repository and login of the fetch, null for the local steps
 * @returns {Record<string, string>} - Environment
 */
export const gitEnv = (base: GitBase, auth: GitAuth | null): Record<string, string> => {
  const settings: [string, string][] = [...GIT_SETTINGS]

  if (auth !== null && auth.username !== null && auth.secret !== null) {
    settings.push([
      `http.${auth.repoUrl}.extraHeader`,
      `Authorization: Basic ${basicAuth(auth.username, auth.secret)}`,
    ])
  }

  const env: Record<string, string> = {
    ...base,
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_COUNT: String(settings.length),
  }

  for (const [index, [key, value]] of settings.entries()) {
    env[`GIT_CONFIG_KEY_${index}`] = key
    env[`GIT_CONFIG_VALUE_${index}`] = value
  }

  return env
}
