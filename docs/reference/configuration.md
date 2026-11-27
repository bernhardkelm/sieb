# Configuration

Every environment variable of sieb, of the Auto-check checker and of the Auto-check fetcher, with
its default and meaning, followed by the rules sieb checks before it starts. For how the pieces
fit together, read [Deployment](../deployment.md) and the [Auto-check guide](../auto-check.md)
first.

On this page

- [How values are read](#how-values-are-read)
- [sieb](#sieb): Core, Findings and KEV, Authentication, Claude integration, Auto-check, Private
  access
- [Rules sieb enforces at start](#rules-sieb-enforces-at-start)
- [Checker container](#checker-container)
- [Fetcher container](#fetcher-container)

## How values are read

- Every variable is optional unless a row says otherwise. An unset or blank value means the
  default.
- Booleans take `true`, `false`, `1` or `0` in any case. Any other value refuses to start.
- Integers must lie in the stated range, starting at 1. Ports take 1 to 65535.
- Lists are comma separated. Entries are trimmed, empty entries are dropped.
- A variable with a `_FILE` variant reads the secret from the file that variant names. Setting both
  refuses to start, and so does a file that cannot be read. Prefer the file: a mounted Secret stays
  out of the process environment.
- `npm run dev` and `npm run dev:server` read `.env.local`; copy [.env.example](../../.env.example)
  to start one. The mock scripts ignore that file.

## sieb

The container image `ghcr.io/bernhardkelm/sieb` sets `NODE_ENV=production`,
`SIEB_SOURCE=incluster`, `SIEB_HOST=0.0.0.0`, `SIEB_PORT=3100` and `SIEB_DB_PATH=/data/sieb.db`.
The defaults below are those of the code, outside the image.

### Core

| Variable | Default | Meaning |
| --- | --- | --- |
| `NODE_ENV` | unset | `production` refuses the mock source, turns off the dev user and requires https URLs, see the rules below |
| `SIEB_SOURCE` | `kubectl` | `mock` (fixtures), `kubectl` (local, read-only kubectl) or `incluster` (ServiceAccount). `incluster` counts as production |
| `SIEB_HOST` | `127.0.0.1` | Listen address of every listener |
| `SIEB_PORT` | `3100` | Main port: UI, `/api`, `/auth`, `/mcp`. Also the target of the Vite dev proxy |
| `SIEB_METRICS_PORT` | unset | Serves `/metrics` on this port only, the main port then answers 404. Required in oidc mode |
| `SIEB_DB_PATH` | `data/sieb.db`, mock: `data/sieb-mock.db` | SQLite file, relative to the working directory. Its directory is created when missing |
| `SIEB_ALLOWED_HOSTS` | empty | `Host` values accepted besides loopback names. An entry without a port matches that host on any port |
| `SIEB_PUBLIC_URL` | derived per request | Origin sieb is reached at, such as `https://sieb.example.com`, no path or trailing slash. Used for links, the MCP resource and the OIDC redirect |
| `SIEB_SYNC_INTERVAL_MINUTES` | `15` | Minutes between automatic syncs, 1 to 1440. A sync also runs at start |
| `SIEB_SOURCE_URL` | upstream release tag | http(s) URL of the source code the UI links next to the version (AGPL), for forks |

`NODE_EXTRA_CA_CERTS` is Node's own variable. The `incluster` source needs it set to
`/var/run/secrets/kubernetes.io/serviceaccount/ca.crt` to trust the API server, see
[Kubernetes manifests](../deployment.md#kubernetes-manifests).

### Findings and KEV

| Variable | Default | Meaning |
| --- | --- | --- |
| `SIEB_FINDINGS_QUERY` | `sieb:trivy_finding:info` | PromQL for the findings, see the [label contract](../prometheus-rules.md#findings-query) |
| `SIEB_PROMETHEUS_URL` | `http://kube-prometheus-stack-prometheus.monitoring.svc:9090` | Prometheus base URL of the `incluster` source |
| `SIEB_PROMETHEUS_SERVICE` | `monitoring/kube-prometheus-stack-prometheus:9090` | Prometheus service as `namespace/name:port`, reached by the `kubectl` source through the API server proxy |
| `SIEB_KUBE_CONTEXT` | current context | kubectl context of the `kubectl` source |
| `SIEB_KEV_SOURCE` | `cisa` | `cisa` (sieb fetches the CISA feed daily), `prometheus` (the KEV query, flag only) or `none`, see [KEV source](../deployment.md#kev-source) |
| `SIEB_KEV_URL` | the CISA feed | http(s) URL of the CISA KEV JSON feed or a mirror, read by `cisa` |
| `SIEB_KEV_QUERY` | `sieb:kev:listed` | PromQL for the KEV list with `SIEB_KEV_SOURCE=prometheus`, one series per `vuln_id`, see [KEV query](../prometheus-rules.md#kev-query) |
| `SIEB_PUBLIC_REGISTRIES` | see below | Registry hosts, with an optional port, whose third-party images count as public without a probe. A list replaces the defaults |

The default CISA feed is
`https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`. The default
public registries are `docker.io`, `index.docker.io`, `registry-1.docker.io`, `mirror.gcr.io`,
`ghcr.io`, `quay.io`, `registry.k8s.io`, `gcr.io`, `public.ecr.aws`, `mcr.microsoft.com` and
`cgr.dev`. Own images (owner `self`) are probed on demand instead, see
[Ownership and visibility](../triage.md#ownership-and-visibility).

### Authentication

| Variable | Default | Meaning |
| --- | --- | --- |
| `SIEB_AUTH` | `header` | `header` trusts the forward-auth username header, `oidc` runs sieb's own OpenID Connect login, see [Authentication](../deployment.md#authentication) |
| `SIEB_USER_HEADER` | `X-authentik-username` | Header mode: request header carrying the username set by the proxy. Must be a valid header name |
| `SIEB_DEV_USER` | `dev` | Header mode outside production: acting user when the header is missing |
| `SIEB_OIDC_ISSUER` | unset | Oidc mode, required: issuer URL exactly as the provider shows it, base of OpenID discovery |
| `SIEB_OIDC_CLIENT_ID` | unset | Oidc mode, required: client id of the confidential login client |
| `SIEB_OIDC_CLIENT_SECRET` | unset | Oidc mode, required: its client secret, never logged. There is no `_FILE` variant |
| `SIEB_OIDC_REQUIRED_GROUP` | unset | Entry of the `groups` claim a user must have, unset admits every user of the issuer |
| `SIEB_SESSION_HOURS` | `12` | Absolute session lifetime in hours, 1 to 168 |
| `SIEB_OIDC_DISPLAY_NAME` | `SSO` | Provider name on the sign-in button, "Sign in with SSO" |

### Claude integration (MCP)

Off by default. What these settings enable is described in
[Turn it on](../working-with-claude.md#turn-it-on).

| Variable | Default | Meaning |
| --- | --- | --- |
| `SIEB_MCP_ENABLED` | `false` | Serves `/mcp`, the personal token routes and, with OAuth, the protected resource metadata |
| `SIEB_MCP_ALLOWED_ORIGINS` | empty | Browser origins `/mcp` accepts besides its own host. Requests without `Origin` always pass |
| `SIEB_OAUTH_ISSUER` | unset | Issuer of the connector's client, the exact `iss` claim. Unset, `/mcp` accepts personal tokens only |
| `SIEB_OAUTH_CLIENT_ID` | unset | Client id of the connector's client, the exact `aud` claim. Set together with the issuer |
| `SIEB_OAUTH_JWKS_URL` | discovered | Key set URL, unset reads `jwks_uri` from the issuer's OpenID configuration |
| `SIEB_OAUTH_REQUIRED_GROUP` | unset | Entry of the `groups` claim an OAuth caller must have, unset admits every user of the issuer |
| `SIEB_OAUTH_CLIENT_LABEL` | `Claude` | Client name of OAuth callers in logs, the handshake line and tool results |

### Auto-check

Off by default. Setup is in [Set it up](../auto-check.md#set-it-up).

| Variable | Default | Meaning |
| --- | --- | --- |
| `SIEB_CHECKS_ENABLED` | `false` | Turns on Auto-check: the check queue, the Checks page and the worker listener |
| `SIEB_WORKER_PORT` | unset | Required when on: port of the listener that serves only `/worker`. Never route it through an Ingress |
| `SIEB_WORKER_SECRET` | unset | Required when on: bearer secret of the worker, at least 32 characters without whitespace. sieb has no `_FILE` variant |
| `SIEB_CHECK_TIMEOUT_SECONDS` | `1200` | Time limit of one check, 1 to 14400. sieb fails a check one minute after it, the check's token expires ten minutes after it |
| `SIEB_CHECK_MAX_TURNS` | `60` | Turn limit the worker hands to Claude Code, 1 to 500 |

### Private access

Both variables are optional. Private images and source code become checkable only with both set
and the worker in its two-container layout, see [Private access](../auto-check.md#private-access).

| Variable | Default | Meaning |
| --- | --- | --- |
| `SIEB_CREDENTIALS_KEY` | unset | Key that seals stored access credentials: 32 random bytes in base64 or base64url, for example from `openssl rand -base64 32` |
| `SIEB_CREDENTIALS_KEY_FILE` | unset | File holding that key |
| `SIEB_FETCHER_SECRET` | unset | Bearer secret of the fetcher container, at least 32 characters without whitespace, different from `SIEB_WORKER_SECRET` |
| `SIEB_FETCHER_SECRET_FILE` | unset | File holding that secret |

Without the key, credentials can be neither stored nor used. Without the fetcher secret, the
fetcher routes answer 404 and private images stay ineligible. The fetcher secret is read only
while `SIEB_CHECKS_ENABLED` is on. Rotating the key is described in
[Secrets and rotation](../operations.md#secrets-and-rotation).

## Rules sieb enforces at start

sieb checks its configuration before it opens the database and exits with one line naming the
variable when a rule fails. No message contains a secret.

- Production is `NODE_ENV=production` or `SIEB_SOURCE=incluster`. It refuses the mock source,
  turns off the dev user and requires https for `SIEB_PUBLIC_URL`, `SIEB_OIDC_ISSUER`,
  `SIEB_OAUTH_ISSUER` and `SIEB_OAUTH_JWKS_URL`.
- The mock source refuses to use `data/sieb.db`, so fixtures never touch a live database.
- `SIEB_AUTH=oidc` needs `SIEB_OIDC_ISSUER`, `SIEB_OIDC_CLIENT_ID`, `SIEB_OIDC_CLIENT_SECRET`,
  `SIEB_PUBLIC_URL` and `SIEB_METRICS_PORT`. It never uses the dev user, not even outside
  production, and ignores `SIEB_USER_HEADER`.
- `SIEB_OIDC_CLIENT_ID` and `SIEB_OAUTH_CLIENT_ID` must name separate clients.
- The `SIEB_OAUTH_*` variables are ignored while `SIEB_MCP_ENABLED` is off. With MCP on,
  `SIEB_OAUTH_ISSUER` and `SIEB_OAUTH_CLIENT_ID` come together, need `SIEB_PUBLIC_URL`, and
  `SIEB_OAUTH_JWKS_URL` needs both.
- `SIEB_CHECKS_ENABLED` needs `SIEB_MCP_ENABLED`, `SIEB_PUBLIC_URL`, `SIEB_WORKER_PORT` and a
  valid `SIEB_WORKER_SECRET`. The worker files its proposal through `/mcp` at the public URL.
- `SIEB_METRICS_PORT` must differ from `SIEB_PORT`, and `SIEB_WORKER_PORT` from both.
- `SIEB_FETCHER_SECRET` must be at least 32 characters without whitespace and differ from
  `SIEB_WORKER_SECRET`.
- A malformed `SIEB_CREDENTIALS_KEY` refuses to start, so a typo never turns private access off
  silently.
- `SIEB_PUBLIC_URL` and every `SIEB_MCP_ALLOWED_ORIGINS` entry must be a bare origin: scheme, host
  and optional port, without user info, path or trailing slash.
- A database whose schema is newer than the running code refuses to start, see
  [Upgrades](../operations.md#upgrades).

In production, sieb starts but logs a warning when `SIEB_OIDC_REQUIRED_GROUP` (oidc mode) or
`SIEB_OAUTH_REQUIRED_GROUP` (OAuth on) is unset, since every user of the issuer is then admitted.
With Auto-check on, one start line states whether private access is on, or which of its two
variables is missing.

## Checker container

The default command of `ghcr.io/bernhardkelm/sieb-checker` claims checks and runs Claude Code. The
image sets `NODE_ENV=production` and `SIEB_CHECKER_WORKDIR=/work`. Secrets in this container, and
in the fetcher, must be one line of printable characters without spaces, at most 4096.

| Variable | Default | Meaning |
| --- | --- | --- |
| `SIEB_WORKER_URL` | required | Base URL of sieb's worker listener, for example `http://sieb.sieb.svc:3101` |
| `SIEB_WORKER_SECRET`, `SIEB_WORKER_SECRET_FILE` | required | The value of sieb's `SIEB_WORKER_SECRET` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_API_KEY_FILE` | one credential required | Claude Console API key |
| `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN_FILE` | one credential required | Subscription token from `claude setup-token`, for your own use only |
| `SIEB_CHECKER_WORKDIR` | `/work` | Directory of the check workspaces. With the fetcher it holds only Claude's home and the check's settings |
| `SIEB_CHECKER_POLL_SECONDS` | `10` | Wait between claims while the queue is empty, 1 to 60 |
| `SIEB_CHECKER_IMAGE_MAX_BYTES` | `4294967296` (4 GiB) | Cap on the uncompressed filesystems of all images of one check. With the fetcher it takes effect there |
| `SIEB_CHECKER_PLATFORM` | `linux/amd64` | Platform exported from multi-platform images, `os/arch` or `os/arch/variant` |
| `SIEB_CHECKER_MODEL` | account default | Model alias or id passed as `--model`, such as `opus`. Up to 64 lower-case letters, digits, `.`, `-` and `[]` |
| `SIEB_CHECKER_EFFORT` | Claude Code's default | Passed as `--effort`: `low`, `medium`, `high`, `xhigh` or `max` |
| `SIEB_CHECKER_WEB_DOMAINS` | built-in list | Hosts WebFetch may reach, comma or space separated. `*.example.org` covers every subdomain. A list replaces the defaults |
| `SIEB_FETCHER_URL` | unset | `http://127.0.0.1:<port>` of the fetcher in the same pod, loopback only. Unset runs in single-container mode |
| `SIEB_FETCHER_LOCAL_SECRET`, `SIEB_FETCHER_LOCAL_SECRET_FILE` | required with `SIEB_FETCHER_URL` | Secret the checker and the fetcher share, at least 32 characters |
| `SIEB_CHECKER_SHARED_DIR` | `/shared` | Mount of the shared workspace volume, read-only here. Must differ from `SIEB_CHECKER_WORKDIR` |
| `PATH` | system default | Search path handed to the tools and to Claude Code |

The checker refuses to start with neither or both Claude credentials, with `ANTHROPIC_AUTH_TOKEN`,
which Claude Code would prefer over both, and with `SIEB_FETCHER_SECRET` or
`SIEB_FETCHER_SECRET_FILE`, which belong to the fetcher alone. The default web hosts are listed in
[Web access](auto-check-internals.md#web-access).

## Fetcher container

The fetcher runs from the same image with the command `src/checker/fetcher/fetcherMain.ts`. It
pulls images and checks out source for the checker in the same pod.

| Variable | Default | Meaning |
| --- | --- | --- |
| `SIEB_WORKER_URL` | required | Base URL of sieb's worker listener, as for the checker |
| `SIEB_FETCHER_SECRET`, `SIEB_FETCHER_SECRET_FILE` | required | The value of sieb's `SIEB_FETCHER_SECRET` |
| `SIEB_FETCHER_LOCAL_SECRET`, `SIEB_FETCHER_LOCAL_SECRET_FILE` | required | The secret shared with the checker, at least 32 characters |
| `SIEB_FETCHER_PORT` | `3102` | Port of the local endpoint on `127.0.0.1` |
| `SIEB_CHECKER_WORKDIR` | `/work` | The fetcher's private directory: home, temporary files, registry logins, inventories |
| `SIEB_CHECKER_SHARED_DIR` | `/shared` | Mount of the shared workspace volume, read-write here. Must differ from `SIEB_CHECKER_WORKDIR` |
| `SIEB_CHECKER_IMAGE_MAX_BYTES` | `4294967296` (4 GiB) | Cap on the uncompressed filesystems of all images of one check |
| `SIEB_CHECKER_SOURCE_MAX_BYTES` | `536870912` (512 MiB) | Cap on the checked-out source tree |
| `SIEB_CHECKER_PLATFORM` | `linux/amd64` | Platform exported from multi-platform images |
| `PATH` | system default | Search path handed to crane, syft and git |

The fetcher refuses to start when it holds a secret of the checker: `SIEB_WORKER_SECRET`,
`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_AUTH_TOKEN`, each also as a `_FILE`
variant. One Secret shared by both containers through `envFrom` therefore fails early. Generate
the local secret with, for example, `openssl rand -hex 32`.
