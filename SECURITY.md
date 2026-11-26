# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/bernhardkelm/sieb/security/advisories/new),
not in a public issue. Include the affected version or commit, steps to reproduce and the impact
you see. sieb is maintained in spare time, reports are handled on a best-effort basis.

## Supported versions

Fixes land on `main` and ship with the next release. Only the latest release is supported.

## Scope

sieb relies on a forward-auth proxy and a NetworkPolicy for authentication, see
[docs/deployment.md](docs/deployment.md#security). A deployment without them is out of scope.
