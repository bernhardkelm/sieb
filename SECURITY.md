# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/bernhardkelm/sieb/security/advisories/new),
not in a public issue. Include the affected version or commit, steps to reproduce and the impact
you see. sieb is maintained in spare time, and reports are handled on a best-effort basis.

## Supported versions

Fixes land on `main` and ship with the next release. Only the latest release is supported, for
both images, `sieb` and `sieb-checker`.

## Scope

What sieb guarantees depends on the auth mode, see the
[security checklist](docs/deployment.md#security-checklist):

- `SIEB_AUTH=oidc`: sieb runs its own OpenID Connect login with sessions. Weaknesses in that
  login, its sessions and its cookies are in scope.
- `SIEB_AUTH=header`: sieb has no login of its own and trusts the username header of a
  forward-auth proxy. The proxy must strip client-sent copies of that header, and a NetworkPolicy
  must keep everything but the ingress controller and Prometheus away from the pod. A header mode
  deployment without both is out of scope.

The Claude integration (`SIEB_MCP_ENABLED`, off by default) authenticates only bearer tokens, see
the [MCP security model](docs/reference/mcp.md#security-model). Token handling, the OAuth
verification and any way to make a read-only tool change data are in scope. Claude acting on
advisory text it reads through the tools is a known limit of the model, not a vulnerability of
sieb, unless sieb fails to mark that text as untrusted.

Auto-check (`SIEB_CHECKS_ENABLED`, off by default) runs Claude Code in a worker pod inside your
cluster, described in [How a check runs](docs/reference/auto-check-internals.md#how-a-check-runs).
In scope:

- The worker listener and its secrets: a way to use the worker secret for the fetcher routes, or
  the other way round, or to reach `/worker` without them.
- The separation of the two containers: a way for the checker, which runs Claude, to obtain the
  fetcher secret or a registry or git login, or for anything outside the pod to reach the
  fetcher's local endpoint.
- The token minted for each check: a way to use it beyond its check, its scope or its expiry.
- Stored access credentials: a way to read a secret back through the API, to open a sealed
  credential without `SIEB_CREDENTIALS_KEY`, or to make a credential cover hosts or paths it was
  not stored for.
- The credential test and the pull probe reaching cluster-internal or private addresses.

Out of scope: what Claude does with the files, source code and web pages it is allowed to read
during a check, within the limits listed in
[Known limits](docs/reference/auto-check-internals.md#known-limits). Content of a private image or
repository that a check reads is sent to Anthropic like the rest of the check, by design; see
[Private access](docs/auto-check.md#private-access) before you store credentials.
