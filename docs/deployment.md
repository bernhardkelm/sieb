# Deployment

sieb runs as a single pod next to Prometheus. Silencing only works while Prometheus can scrape that
pod, a sieb instance on your laptop is not scraped.

## Data sources

| `SIEB_SOURCE` | Reads | Typical use |
| --- | --- | --- |
| `mock` | Synthetic fixtures in `src/server/sources/mock/fixtures/` | Development, demos. Refused with `NODE_ENV=production` |
| `kubectl` | Spawns read-only `kubectl get vulnerabilityreports -A` and `kubectl get --raw` on the API server proxy of `SIEB_PROMETHEUS_SERVICE` | Local live mode |
| `incluster` | `https://kubernetes.default.svc` with the ServiceAccount token, Prometheus at `SIEB_PROMETHEUS_URL` | In the cluster, counts as production |

The `kubectl` source needs `get` and `list` on `vulnerabilityreports.aquasecurity.github.io` in all
namespaces and `get` on `services/proxy` for the Prometheus service.

## KEV feed

With the default `SIEB_KEV_SOURCE=cisa`, sieb downloads the
[CISA KEV catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) itself, once a day,
from `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`, and keeps
the last good copy in its database when a download fails. The pod then needs outbound HTTPS (443) to
`www.cisa.gov` and DNS. Without that egress:

- set `SIEB_KEV_URL` to a mirror you can reach, for example an internal copy of the feed or
  `https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json`,
- or use `SIEB_KEV_SOURCE=prometheus` with a KEV recording rule, see
  [prometheus-rules.md](prometheus-rules.md#kev-query),
- or `SIEB_KEV_SOURCE=none` to run without KEV.

A failing download shows on the sync status in the UI (the status dot turns amber once the catalog
is older than two days) and in the logs as `KEV catalog fetch failed`. Mock mode never downloads
the feed.

## Container image

```sh
docker pull ghcr.io/bernhardkelm/sieb:latest
```

Releases publish `x.y.z`, `x.y` and `latest`, tags have no `v` prefix and there is no bare major
tag while sieb is 0.x. `edge` follows `main`. Pin an exact version in production.

Multi-arch (`linux/amd64`, `linux/arm64`), runs as the unprivileged `node` user (uid 1000) and
defaults to `NODE_ENV=production`, `SIEB_SOURCE=incluster`, `SIEB_HOST=0.0.0.0`, `SIEB_PORT=3100` and
`SIEB_DB_PATH=/data/sieb.db`. Mount a volume at `/data`. A quick look with the fixtures:

```sh
docker run --rm -p 3100:3100 -e NODE_ENV= -e SIEB_SOURCE=mock -e SIEB_DB_PATH=/data/sieb-mock.db \
  ghcr.io/bernhardkelm/sieb:latest
```

## Authentication

sieb has two ways to know who uses the UI, chosen with `SIEB_AUTH`:

| `SIEB_AUTH` | Who authenticates the UI | Ingress |
| --- | --- | --- |
| `header` (default) | A forward-auth proxy in front of sieb, sieb trusts its username header (`SIEB_USER_HEADER`, default `X-authentik-username`) | Behind the forward-auth middleware, plus a second Ingress without it for `/mcp` when MCP is on |
| `oidc` | sieb itself: an OpenID Connect login against your identity provider, with sessions in its database | One Ingress without forward auth for UI, `/api`, `/mcp` and `/.well-known` |

In both modes the acting user is the username of your identity provider: the forward-auth header
carries it, and the OIDC login reads it from the `preferred_username` claim of the ID token. With
the same provider, decisions made before and after a switch keep the same names in their history.

### Header mode

sieb has no login of its own and trusts the username header set by the forward-auth proxy. Expose
the UI through an Ingress with the forward-auth middleware; see [Security](#security) for what the
proxy and the network must guarantee. The read routes answer without a user, writes need one.

### OIDC mode

sieb runs the authorization code flow with PKCE (S256), state and nonce itself, as a confidential
client of the issuer:

| Variable | Meaning |
| --- | --- |
| `SIEB_AUTH=oidc` | Turns the login on; the username header is then ignored everywhere and there is no dev user, not even outside production |
| `SIEB_OIDC_ISSUER` | Issuer URL exactly as the provider shows it, for authentik `https://authentik.example.com/application/o/sieb/` with the trailing slash; everything else is discovered from it |
| `SIEB_OIDC_CLIENT_ID`, `SIEB_OIDC_CLIENT_SECRET` | Credentials of the client; keep the secret in a Kubernetes Secret, sieb never logs it |
| `SIEB_OIDC_REQUIRED_GROUP` | Optional entry of the `groups` claim a user must have, else the login answers 403 |
| `SIEB_SESSION_HOURS` | Session lifetime, default 12, 1 to 168 |
| `SIEB_OIDC_DISPLAY_NAME` | Provider name on the sign-in button ("Sign in with SSO"), default `SSO` |
| `SIEB_PUBLIC_URL` | Required. The redirect URI is `SIEB_PUBLIC_URL` + `/auth/callback` and the post-logout redirect is `SIEB_PUBLIC_URL` + `/`, both derived from this value and never from request headers |
| `SIEB_METRICS_PORT` | Required, so `/metrics` is never served on the public port, see [Metrics port](#metrics-port) |

The issuer and the public URL must be https in production. The flow:

1. A page request without a session is sent to the sign-in page `/auth/signin?return=<path>`,
   `/api` and files answer 401. The page is rendered by the server and loads nothing (the
   client's assets need a session): the sieb mark, a "Sign in with `SIEB_OIDC_DISPLAY_NAME`"
   button that starts the login, and nothing else. The return path must be relative, anything
   else returns to `/`. The client does the same when a read answers 401, so an expired session
   shows the page instead of a silent new login.
2. The button leads to `/auth/login`, which seals state, nonce, PKCE verifier and return path
   (encrypted with A256GCM under a key made at process start, valid 10 minutes) into the
   HttpOnly login cookie
   (`__Host-sieb_login` over https, `sieb_login` over http, both Path=/), then redirects to the
   issuer with the scopes `openid profile email groups`. Pending logins are not stored, so a flood
   of login requests evicts nobody; a restart invalidates them, which only means logging in
   again. The callback clears the cookie and remembers the hash of its state until the seal
   expires (at most 5000, oldest dropped first), so each login cookie works once.
3. `/auth/callback` exchanges the code, verifies the ID token (signature against the issuer's key
   set, issuer, audience, expiry, nonce), requires `preferred_username` and the required group,
   and creates a session.
4. The session cookie is `__Host-sieb_session` (Secure, HttpOnly, SameSite=Lax, Path=/, no Domain)
   over https, and `sieb_session` without Secure over plain http in development. The database
   keeps only the sha-256 of the random session id. A session ends after `SIEB_SESSION_HOURS`
   however active it is; logging in again is the sign-in button and a redirect round trip, since
   the identity provider keeps its own session. Expired sessions are removed on use and every 15 minutes.
5. "Log out" in the username menu calls `POST /auth/logout`, which deletes the session, sets a
   short-lived signed-out cookie (`__Host-sieb_signedout`, `sieb_signedout` over http, HttpOnly,
   SameSite=Lax, 5 minutes) and sends the browser to the provider's end-session endpoint with
   `id_token_hint`. The provider returns to `SIEB_PUBLIC_URL/`, which shows the sign-in page with
   "You are signed out of sieb." and clears the cookie. authentik's default invalidation flow ends
   only the session of the sieb application and keeps the authentik session, so users stay
   signed in to other applications, and "Sign in" logs them back in without a password prompt.

The log has one line per login (username), failed login (reason, never a token), logout and
session cleanup.

### authentik setup for the UI login

Create an application `sieb` with an **OAuth2/OpenID provider**. It replaces the forward-auth
proxy application of header mode and its tile.

- **Client type:** confidential. Copy client id and secret into `SIEB_OIDC_CLIENT_ID` and
  `SIEB_OIDC_CLIENT_SECRET`.
- **Redirect URIs:** strict `https://sieb.example.com/auth/callback`. For local development add
  `http://localhost:5173/auth/callback` on the same provider, with `SIEB_PUBLIC_URL` set to
  `http://localhost:5173`.
- **Post-logout redirect URI:** `https://sieb.example.com/` (and `http://localhost:5173/` for
  development). Without it authentik stops on its own logout page instead of returning to sieb.
  The sign-in page shown after the logout needs no URI of its own.
- **Grant types:** make sure `authorization_code` is allowed; a provider without it rejects the
  flow with a bare "invalid grant_type".
- **Scopes:** the default `openid`, `email` and `profile` mappings. authentik's default profile
  mapping carries the `groups` claim; sieb also requests a `groups` scope for providers that need
  one, authentik drops scopes it has no mapping for.
- **Signing key:** select an RSA or EC key. sieb checks the ID token signature against the
  provider's key set, and an ID token without a signing key (HS256 with the client secret) is
  refused.
- **Subject mode and username:** the default keeps `preferred_username` equal to the authentik
  username, which is what decisions record.
- **Access:** bind the application to your group, for example `sieb-users`, and set the same name in
  `SIEB_OIDC_REQUIRED_GROUP`, so a user outside it is refused by both.

### Identity provider for the MCP client

The Claude connector of the MCP endpoint signs in through a second client of the identity
provider, separate from the UI login (for authentik a separate application, for example
`sieb-mcp`). sieb refuses to start when `SIEB_OIDC_CLIENT_ID` and `SIEB_OAUTH_CLIENT_ID` are the
same. The full client setup, scopes and claims are in
[mcp.md](mcp.md#identity-provider); for the deployment:

- **Public client.** Register it without a client secret, claude.ai gets only the client id.
  sieb never sees a secret of this client, it only verifies the access tokens. A confidential
  client works too, its secret is then entered in claude.ai.
- **PKCE enforced.** The authorization code flow must use PKCE with `S256`. If your provider
  accepts requests without PKCE, or with the `plain` method, add a policy that requires
  `code_challenge_method=S256` for this client, so an intercepted code is useless without the
  verifier.
- **Refresh tokens with rotation.** Keep the access token validity short (minutes) and let
  refresh tokens carry the session; with rotation every refresh issues a new refresh token and
  invalidates the old one.
- **Audience and signing key.** The access token's `aud` must be the client id alone, signed with
  RS256 or ES256 by a key of the issuer's key set.
- **Group.** Admit only your group to the client and set the same name as
  `SIEB_OAUTH_REQUIRED_GROUP`; in production sieb warns at startup without it.
- **Client label.** Every OAuth caller appears under `SIEB_OAUTH_CLIENT_LABEL` in the logs, the
  handshake line and `get_overview`, default `Claude`. Keep a generic label such as `Claude`: the
  Claude apps and Claude Code, which picks up the connector from claude.ai, use the same client,
  so the label cannot tell them apart.

## Metrics port

`SIEB_METRICS_PORT` serves `/metrics`, and only that, on a second listener on `SIEB_HOST`. The main
port then answers `/metrics` with 404 `{ "error": "not_found" }`. It is required in oidc mode and optional in header
mode, where leaving it unset keeps `/metrics` on the main port. The metrics listener keeps the
`Host` exemption of `/metrics`, so Prometheus can scrape it by pod IP.

## Auto-check

Auto-check is off by default. With `SIEB_CHECKS_ENABLED=true`, which needs `SIEB_MCP_ENABLED` and
`SIEB_PUBLIC_URL`, sieb opens an extra listener on `SIEB_WORKER_PORT` (for example 3101) that
serves only the worker routes behind `SIEB_WORKER_SECRET`. The worker, `sieb-checker`, is a
separate Deployment of its own image without cluster access. For sieb itself:

- pass `SIEB_WORKER_SECRET` as an environment variable from a Secret; sieb has no `_FILE`
  variant, the worker reads the same value from `SIEB_WORKER_SECRET_FILE`;
- add the worker port to the Service, for example as port `worker` with `targetPort` 3101, and
  never route it through an Ingress;
- allow the worker pod on that port in sieb's [NetworkPolicy](#networkpolicy);
- keep `/mcp` on `SIEB_PUBLIC_URL` reachable from the worker, which files its proposal there.

The worker settings, its security model, the Claude credential and the manifests are in
[auto-check.md](auto-check.md), the routes and rules in [api.md](api.md#auto-check), and example
alerts in [prometheus-rules.md](prometheus-rules.md#auto-check-alerts).

## Kubernetes

Example manifests, adapt namespace, hostname, storage and the labels of your Prometheus and ingress
controller. SQLite allows one writer, so keep one replica and the `Recreate` strategy. The example
runs oidc mode with MCP enabled (personal tokens only; add the `SIEB_OAUTH_*` variables of
[mcp.md](mcp.md#connector-in-claudeai) for the Claude connector) behind one Ingress.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: sieb
  namespace: sieb
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: sieb
rules:
  - apiGroups: [aquasecurity.github.io]
    resources: [vulnerabilityreports]
    verbs: [get, list]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: sieb
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: sieb
subjects:
  - kind: ServiceAccount
    name: sieb
    namespace: sieb
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: sieb-data
  namespace: sieb
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sieb
  namespace: sieb
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app.kubernetes.io/name: sieb
  template:
    metadata:
      labels:
        app.kubernetes.io/name: sieb
    spec:
      serviceAccountName: sieb
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: sieb
          image: ghcr.io/bernhardkelm/sieb:0.1.0
          env:
            - name: NODE_EXTRA_CA_CERTS
              value: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
            - name: SIEB_ALLOWED_HOSTS
              value: sieb.example.com
            - name: SIEB_PUBLIC_URL
              value: https://sieb.example.com
            - name: SIEB_PROMETHEUS_URL
              value: http://kube-prometheus-stack-prometheus.monitoring.svc:9090
            - name: SIEB_METRICS_PORT
              value: "9100"
            - name: SIEB_AUTH
              value: oidc
            - name: SIEB_OIDC_ISSUER
              value: https://authentik.example.com/application/o/sieb/
            - name: SIEB_OIDC_REQUIRED_GROUP
              value: sieb-users
            - name: SIEB_OIDC_CLIENT_ID
              valueFrom:
                secretKeyRef:
                  name: sieb-oidc
                  key: client-id
            - name: SIEB_OIDC_CLIENT_SECRET
              valueFrom:
                secretKeyRef:
                  name: sieb-oidc
                  key: client-secret
            - name: SIEB_MCP_ENABLED
              value: "true"
          ports:
            - name: http
              containerPort: 3100
            - name: metrics
              containerPort: 9100
          readinessProbe:
            httpGet:
              path: /api/health
              port: http
          livenessProbe:
            httpGet:
              path: /api/health
              port: http
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: [ALL]
          volumeMounts:
            - name: data
              mountPath: /data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: sieb-data
---
apiVersion: v1
kind: Service
metadata:
  name: sieb
  namespace: sieb
  labels:
    app.kubernetes.io/name: sieb
spec:
  selector:
    app.kubernetes.io/name: sieb
  ports:
    - name: http
      port: 3100
      targetPort: http
    - name: metrics
      port: 9100
      targetPort: metrics
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: sieb
  namespace: sieb
spec:
  jobLabel: app.kubernetes.io/name
  selector:
    matchLabels:
      app.kubernetes.io/name: sieb
  endpoints:
    - port: metrics
      path: /metrics
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: sieb
  namespace: sieb
spec:
  rules:
    - host: sieb.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: sieb
                port:
                  name: http
  tls:
    - hosts: [sieb.example.com]
      secretName: sieb-tls
```

The Ingress routes only the `http` port; the `metrics` port is reached by Prometheus inside the
cluster. `jobLabel` sets `job="sieb"`, which the `SiebDown` example in
[prometheus-rules.md](prometheus-rules.md#silencing-alerts) expects. Depending on your
kube-prometheus-stack values, the ServiceMonitor may need the `release` label of your Prometheus.
Without `SIEB_METRICS_PORT` in header mode, drop the `metrics` port and point the ServiceMonitor
at `port: http`.

In header mode the Deployment drops `SIEB_AUTH` and the `SIEB_OIDC_*` variables and the Ingress
carries the forward-auth middleware. With MCP on, `/mcp` and the two
`/.well-known/oauth-protected-resource` paths then need a second Ingress without forward auth,
since MCP clients cannot pass the proxy login. Prefer oidc mode over this setup: it needs one
Ingress and no header sieb has to trust. If you stay in header mode, the second Ingress must

- route only `/mcp`, `/.well-known/oauth-protected-resource` and
  `/.well-known/oauth-protected-resource/mcp`, each with `pathType: Exact`, since everything else
  on it bypasses the proxy (sieb also refuses dot segments such as `/mcp/%2e%2e/api/me` with 400);
- set the username header to an empty value, so no client-sent copy reaches sieb on that route.
  With Traefik a headers middleware does it, an empty value removes the header:

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: sieb-strip-user
  namespace: sieb
spec:
  headers:
    customRequestHeaders:
      X-authentik-username: ""
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: sieb-mcp
  namespace: sieb
  annotations:
    traefik.ingress.kubernetes.io/router.middlewares: sieb-sieb-strip-user@kubernetescrd
spec:
  rules:
    - host: sieb.example.com
      http:
        paths:
          - path: /mcp
            pathType: Exact
            backend:
              service:
                name: sieb
                port:
                  name: http
          - path: /.well-known/oauth-protected-resource
            pathType: Exact
            backend:
              service:
                name: sieb
                port:
                  name: http
          - path: /.well-known/oauth-protected-resource/mcp
            pathType: Exact
            backend:
              service:
                name: sieb
                port:
                  name: http
  tls:
    - hosts: [sieb.example.com]
      secretName: sieb-tls
```

### Switching an existing header deployment to oidc

1. Deploy with `SIEB_AUTH=header` plus `SIEB_METRICS_PORT` and the ServiceMonitor on the
   `metrics` port. Nothing visible changes.
2. Create the authentik application, add the `SIEB_OIDC_*` variables and the Secret, set
   `SIEB_AUTH=oidc`, remove the forward-auth middleware from the Ingress (and the second MCP
   Ingress) and allow egress to authentik. Rolling back means reverting this step.

Check from outside afterwards: `/` redirects to the sign-in page and its button to authentik,
`/api/findings` answers 401, `/metrics` 404, `/mcp` without a token 401 (with MCP on), login and logout work, and new decisions
record the same username as before.

## Security

### Both modes

- `SIEB_ALLOWED_HOSTS` must contain the public hostname. Every other `Host` is refused (DNS
  rebinding protection), except on `/metrics` and `/api/health`, which Prometheus and the kubelet
  reach by pod IP.
- Writes require `Content-Type: application/json` and a same-origin request, see [api.md](api.md).
  So does `POST /auth/logout`.
- `/mcp` authenticates only through bearer tokens and ignores both the username header and the
  session cookie; bearer tokens are never accepted under `/api`. See [mcp.md](mcp.md).
- A request target with a dot segment (`/mcp/%2e%2e/api/me`, `/a/../b`, any case or encoding)
  answers 400 before anything else, so no request reaches a route its Ingress rule did not name.
- Every response sends `X-Content-Type-Options: nosniff` and `Content-Security-Policy:
  frame-ancestors 'none'`.
- Personal tokens expire after at most a year (30 days, 90 days or 1 year), and revoked or
  expired token rows are deleted 90 days later, or earlier by their owner in the token dialog.
  To revoke every live token of a user at once:

  ```sh
  kubectl -n sieb exec deploy/sieb -- node -e "
    const { DatabaseSync } = require('node:sqlite')
    console.log(new DatabaseSync('/data/sieb.db').prepare(\"UPDATE api_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), revoked_by = 'admin' WHERE owner = ? AND revoked_at IS NULL\").run(process.argv[1]))
  " alice
  ```

- In production sieb warns at startup when `SIEB_OIDC_REQUIRED_GROUP` (oidc mode) or
  `SIEB_OAUTH_REQUIRED_GROUP` (MCP with OAuth) is unset, since every user of the issuer is then
  admitted.

### Header mode

sieb trusts the username header (`SIEB_USER_HEADER`, default `X-authentik-username`) set by a
forward-auth proxy in front of it. Not enforced by code, required for identity and write
protection to hold:

- The proxy must overwrite or strip any client-sent copy of that header on every request. With
  Traefik's forwardAuth middleware, list the header in `authResponseHeaders`. With other proxies,
  set `SIEB_USER_HEADER` to the header they set, for example `X-Auth-Request-User` for oauth2-proxy,
  and make sure they strip incoming copies.
- A NetworkPolicy must allow ingress to the sieb pod only from the ingress controller and from
  Prometheus, so nothing else can reach the pod and send its own username header (see
  [NetworkPolicy](#networkpolicy)).
- `/metrics` and the read routes need no user in this mode. They list CVE ids and image names of
  your cluster, so never expose a header mode sieb without the forward-auth proxy in front of it;
  only `/mcp` and its metadata may bypass the proxy, since they check bearer tokens themselves. With `SIEB_METRICS_PORT`,
  `/metrics` leaves the public port.

### OIDC mode

- Everything needs a session except `/auth/*`, `/api/health`, `/mcp` and
  `/.well-known/oauth-protected-resource*` (bearer tokens, when MCP is enabled) and the icons and
  web manifest of the client. `/api` answers 401 without a session, reads included; pages redirect
  to the login; the client's scripts and styles answer 401.
- `/metrics` is never served on the public port, only on `SIEB_METRICS_PORT`.
- The username header is ignored, so a client-sent `X-authentik-username` has no effect and the
  Ingress needs no forward-auth middleware.
- Sessions have an absolute lifetime and are stored as sha-256 hashes; the login cookie and the
  session cookie are HttpOnly, SameSite=Lax and `__Host-` cookies over https, so a sibling
  subdomain cannot plant either.
  Removing a user from the group stops new logins at once, and such a refused login also deletes
  every session of the user and revokes their live personal tokens (logged). Until the user tries
  to log in, a running session ends at its expiry or logout. To end every session of a user
  immediately, delete them (and revoke their tokens with the command above):

  ```sh
  kubectl -n sieb exec deploy/sieb -- node -e "
    const { DatabaseSync } = require('node:sqlite')
    console.log(new DatabaseSync('/data/sieb.db').prepare('DELETE FROM sessions WHERE username = ?').run(process.argv[1]))
  " alice
  ```

- Known exception: each session stores the ID token it was opened with, and the logout sends it
  to the issuer as `id_token_hint` in the end-session URL, so authentik ends the application
  session and returns to sieb without a confirmation page. This is standard RP-initiated logout.
  The ID token is a signed statement of who logged in, not an access token: sieb accepts it
  nowhere (`/mcp` requires the MCP client as the only audience and the `sieb:read` scope), it is
  deleted with the session row, and the database file should be protected like any credential
  store.

### NetworkPolicy

Ingress to the pod: the `http` port from the ingress controller, the `metrics` port from
Prometheus (in header mode without a metrics port, the `http` port from both):

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sieb
  namespace: sieb
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: sieb
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress
      ports:
        - port: http
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
      ports:
        - port: metrics
```

If you also restrict egress, allow DNS, the Kubernetes API, Prometheus, for the `cisa` KEV source
HTTPS to `www.cisa.gov`, and in oidc mode (or with MCP OAuth) HTTPS to the issuer host, which sieb
contacts for discovery, the token exchange and the key set. When authentik runs in the same
cluster, allow its namespace and port instead; when it is reached through its public hostname,
the traffic leaves through the ingress controller's address. A NetworkPolicy cannot match host
names, so either allow port 443 to addresses outside the cluster, use an egress proxy or a CNI with
FQDN policies, or point `SIEB_KEV_URL` at a mirror inside the cluster. A sketch of the first
option, the CIDRs are placeholders for your pod and service ranges:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sieb-egress-https
  namespace: sieb
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: sieb
  policyTypes: [Egress]
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except: [10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16]
      ports:
        - port: 443
          protocol: TCP
```

Egress policies add up, so the rules for DNS, the API server, Prometheus and an in-cluster
authentik go in further policies.
