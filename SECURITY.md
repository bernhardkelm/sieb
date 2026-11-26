# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/bernhardkelm/sieb/security/advisories/new),
not in a public issue. Include the affected version or commit, steps to reproduce and the impact
you see. sieb is maintained in spare time, reports are handled on a best-effort basis.

## Supported versions

Fixes land on `main` and ship with the next release. Only the latest release is supported.

## Scope

What sieb guarantees depends on the auth mode, see
[docs/deployment.md](docs/deployment.md#security):

- `SIEB_AUTH=header` (default): sieb has no login of its own and trusts the username header of a
  forward-auth proxy. The proxy must strip client-sent copies of that header, and a NetworkPolicy
  must keep everything but the ingress controller and Prometheus away from the pod. A header mode
  deployment without both is out of scope.
- `SIEB_AUTH=oidc`: sieb runs its own OpenID Connect login with sessions and needs neither a
  forward-auth proxy nor the header. Weaknesses in that login, its sessions and cookies are in
  scope.

The MCP endpoint for Claude (`SIEB_MCP_ENABLED`, off by default) authenticates only bearer tokens,
in both modes, see [docs/mcp.md](docs/mcp.md#security-model). Token handling, the OAuth
verification and ways to make a read-only tool change data are in scope. Claude acting on
advisory text it reads through the tools is a known limit of the model, not a vulnerability of
sieb, unless sieb fails to mark that text as untrusted.
