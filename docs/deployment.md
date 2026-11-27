# Deployment

This guide is for operators who run sieb in a cluster. It covers the images, where sieb reads its
data, how users sign in, how to expose it, the full manifest set, the NetworkPolicy and what to
check before you rely on it. For a first deployment in five steps, start with
[Getting started](getting-started.md). Every variable is listed in the
[configuration reference](reference/configuration.md).

On this page

- [Overview](#overview)
- [Container images](#container-images)
- [Data sources](#data-sources)
- [KEV source](#kev-source)
- [Authentication](#authentication)
- [Exposing sieb](#exposing-sieb)
- [Metrics port](#metrics-port)
- [Kubernetes manifests](#kubernetes-manifests)
- [NetworkPolicy](#networkpolicy)
- [Security checklist](#security-checklist)
- [Optional features](#optional-features)

## Overview

sieb is one Node process with a SQLite database. It runs as a single pod next to Prometheus,
because silencing works only while Prometheus can scrape it.

```text
users --> Ingress --> :3100 sieb pod --> Kubernetes API     VulnerabilityReports, read only
                              |      --> Prometheus         findings rule, optional KEV rule
                              |      --> www.cisa.gov       KEV catalog, once a day
                              |      --> identity provider  oidc mode, Claude connector
                              |
          Prometheus --> :9100 /metrics
                              |
                        /data/sieb.db   one volume, one writer
```

Keep one replica with the `Recreate` strategy: SQLite allows one writer, and a rolling update
would start a second one.

## Container images

```sh
docker pull ghcr.io/bernhardkelm/sieb:<version>
```

Releases publish the tags `x.y.z`, `x.y` and `latest`, without a `v` prefix. There is no bare
major tag while sieb is 0.x, and a prerelease gets only its full version. `edge` follows `main`,
and every published build also gets a `sha-<commit>` tag. Images are built for `linux/amd64` and
`linux/arm64`. Pin an exact version in production.

The image runs as the unprivileged `node` user (uid 1000) and sets `NODE_ENV=production`,
`SIEB_SOURCE=incluster`, `SIEB_HOST=0.0.0.0`, `SIEB_PORT=3100` and `SIEB_DB_PATH=/data/sieb.db`.
Mount a writable volume at `/data`. Its health check calls `/api/health`.

The Auto-check worker has its own image, `ghcr.io/bernhardkelm/sieb-checker:<version>`, with the
same tags and platforms. Use the same release for both, see [Upgrades](operations.md#upgrades).

## Data sources

`SIEB_SOURCE` decides where findings come from:

| `SIEB_SOURCE` | Reads | Use |
| --- | --- | --- |
| `mock` | Synthetic fixtures in `src/server/sources/mock/fixtures/` | Development and demos. Refused in production |
| `kubectl` | Read-only `kubectl get vulnerabilityreports -A` and the API server proxy of `SIEB_PROMETHEUS_SERVICE` | Local live mode on your machine |
| `incluster` | `https://kubernetes.default.svc` with the ServiceAccount token, Prometheus at `SIEB_PROMETHEUS_URL` | In the cluster. Counts as production |

Both live sources join the findings rule of Prometheus with the VulnerabilityReports of the Trivy
Operator. The rule decides what counts as a finding, see
[Findings query](prometheus-rules.md#findings-query).

The `incluster` source needs `get` and `list` on `vulnerabilityreports.aquasecurity.github.io` in
all namespaces, granted by the ClusterRole in the manifests below. It trusts the API server
through `NODE_EXTRA_CA_CERTS`. The `kubectl` source additionally needs `get` on `services/proxy`
for the Prometheus service.

## KEV source

sieb marks findings whose CVE is in the CISA
[Known Exploited Vulnerabilities](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
catalog and ranks them first. `SIEB_KEV_SOURCE` picks where that listing comes from:

| `SIEB_KEV_SOURCE` | Where the listing comes from | What it needs |
| --- | --- | --- |
| `cisa` (default) | sieb downloads the catalog once a day and keeps the last good copy | HTTPS to `www.cisa.gov`, or a mirror in `SIEB_KEV_URL` |
| `prometheus` | The KEV rule `SIEB_KEV_QUERY`, read with every sync. The panel shows no catalog details | A KEV recording rule, see [KEV query](prometheus-rules.md#kev-query) |
| `none` | No KEV listing. Triage ranks by exposure, severity and score, and the UI hides KEV elements | Nothing |

Without egress to `www.cisa.gov`, point `SIEB_KEV_URL` at a copy you can reach, for example an
internal mirror or
`https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json`.
Mock mode never downloads the catalog.

A decision remembers whether its CVE was KEV listed. Switching from `none` to a KEV source
therefore re-opens decisions whose CVEs turn out to be listed. How refreshes and failures behave
is in [KEV catalog health](operations.md#kev-catalog-health).

## Authentication

sieb records every decision under the username of the person who made it. `SIEB_AUTH` picks how
it learns that name:

| `SIEB_AUTH` | Who signs users in | Ingress |
| --- | --- | --- |
| `oidc` (recommended) | sieb itself, with OpenID Connect against your identity provider and sessions in its database | One Ingress without forward auth |
| `header` (default) | A forward-auth proxy in front of sieb. sieb trusts its username header | Behind the forward-auth middleware, plus a second Ingress for `/mcp` when MCP is on |

Prefer oidc mode. It needs one Ingress and no header that sieb has to trust. In both modes the
username is the one of your identity provider: the proxy's header carries it, and the login reads
it from the `preferred_username` claim. With the same provider, decisions keep the same names
after you switch modes.

### OIDC mode

These settings turn it on:

| Variable | Value |
| --- | --- |
| `SIEB_AUTH` | `oidc` |
| `SIEB_OIDC_ISSUER` | Issuer URL exactly as the provider shows it, https in production. Everything else is discovered from it |
| `SIEB_OIDC_CLIENT_ID`, `SIEB_OIDC_CLIENT_SECRET` | The confidential client. Keep both in a Secret, sieb never logs the secret |
| `SIEB_PUBLIC_URL` | Required. The redirect URI is `SIEB_PUBLIC_URL/auth/callback`, never derived from request headers |
| `SIEB_METRICS_PORT` | Required, so `/metrics` never answers on the public port, see [Metrics port](#metrics-port) |

Set `SIEB_OIDC_REQUIRED_GROUP` to admit only members of one group; in production sieb warns at
start without it. `SIEB_SESSION_HOURS` (default 12) and `SIEB_OIDC_DISPLAY_NAME` (default `SSO`)
are optional.

What users and operators see:

1. A page request without a session shows sieb's sign-in page with one button, "Sign in with SSO".
   `/api` answers 401 without a session, reads included.
2. The button runs the authorization code flow with PKCE, state and nonce, and returns to the page
   the user asked for.
3. sieb verifies the ID token, requires `preferred_username` and the group, and opens a session.
   A session ends after `SIEB_SESSION_HOURS`, however active it is. Signing in again is one
   redirect, since the provider keeps its own session.
4. **Log out** in the user menu ends the session and sends the browser to the provider's
   end-session endpoint, which returns to sieb's sign-in page with "You are signed out of sieb."

The log has one line per login, failed login (with the reason, never a token) and logout. Cookie
names and the sealing of the login state are in the [API reference](reference/api.md).

### Identity provider checklist

Any OpenID Connect provider works. Create one client for the sieb login with these settings:

- Client type confidential. sieb authenticates at the token endpoint with `client_secret_post`.
- Redirect URI `https://sieb.example.com/auth/callback`, matched strictly. For local development
  add `http://localhost:5173/auth/callback` and set `SIEB_PUBLIC_URL=http://localhost:5173`.
- Post-logout redirect URI `https://sieb.example.com/`. Without it, many providers stop on their
  own logout page.
- Grant type `authorization_code` allowed.
- Scopes `openid`, `profile` and `email`. sieb also requests `groups`; providers that need a scope
  for the `groups` claim get it, others ignore it.
- `preferred_username` in the ID token, holding the username you want in decisions.
- An asymmetric signing key (RSA or EC). ID tokens signed with the client secret are refused.
- Access limited to your group, with the same group name in `SIEB_OIDC_REQUIRED_GROUP`.

The Claude connector needs a second, separate client. sieb refuses to start when both use the same
client id. Its setup is in [Connect](working-with-claude.md#connect).

### Example: authentik

In authentik, create an application `sieb` with an **OAuth2/OpenID provider**. In oidc mode it
replaces the forward-auth proxy application of header mode.

- **Client type**: confidential. Copy the client id and secret into the `sieb-oidc` Secret.
- **Redirect URIs**: strict, `https://sieb.example.com/auth/callback`.
- **Post-logout redirect URI**: `https://sieb.example.com/`.
- **Grant types**: make sure `authorization_code` is allowed. Without it the flow fails with a
  bare "invalid grant_type".
- **Scopes**: the default `openid`, `email` and `profile` mappings. The default profile mapping
  carries the `groups` claim.
- **Signing key**: select an RSA or EC key.
- **Subject mode**: the default keeps `preferred_username` equal to the authentik username.
- **Access**: bind the application to a group such as `sieb-users` and set the same name in
  `SIEB_OIDC_REQUIRED_GROUP`, so a user outside it is refused by both.

The issuer is `https://authentik.example.com/application/o/sieb/`, with the trailing slash.
authentik's default invalidation flow ends only the sieb application session on logout, so users
stay signed in to other applications, and **Sign in** logs them back in without a password prompt.

### Header mode

sieb has no login of its own and trusts the username header that a forward-auth proxy sets,
`X-authentik-username` by default. Set `SIEB_USER_HEADER` to the header your proxy uses, for
example `X-Auth-Request-User` for oauth2-proxy. The proxy must overwrite or strip any copy of that
header a client sends, and a NetworkPolicy must keep everything else away from the pod. Both are
on the [Security checklist](#security-checklist), because sieb cannot enforce them.

### Switching from header mode to oidc

1. While still in header mode, add `SIEB_METRICS_PORT`, the `metrics` Service port and a
   ServiceMonitor on that port. Nothing visible changes.
2. Create the identity provider client, add the `SIEB_OIDC_*` variables and their Secret, set
   `SIEB_AUTH=oidc`, remove the forward-auth middleware from the Ingress, delete the second MCP
   Ingress if you have one, and allow egress to the issuer. Rolling back means reverting this step.

Check from outside afterwards: `/` shows the sign-in page, `/api/findings` answers 401, `/metrics`
answers 404, `/mcp` without a token answers 401 (with MCP on), sign-in and log out work, and a new
decision records the same username as before.

## Exposing sieb

Route the main port through one Ingress with TLS. Two variables must match the hostname:

- `SIEB_ALLOWED_HOSTS` lists the public hostname. sieb refuses every other `Host` with 403
  `forbidden_host`, except loopback names and the two paths reached by pod IP, `/metrics` and
  `/api/health`. This blocks DNS rebinding.
- `SIEB_PUBLIC_URL` is the origin users reach, `https://sieb.example.com`. It is required in oidc
  mode and for the Claude connector, and makes every link sieb hands out independent of the
  request.

Never route the metrics port or the Auto-check worker port through an Ingress.

sieb also refuses a request target with a dot segment (`/mcp/%2e%2e/api/me`) with 400, so no path
can reach a route its Ingress rule did not name. Writes need a same-origin request with
`Content-Type: application/json`; a proxy must not rewrite `Origin` or `Host`. The exact rules are
in [Request rules](reference/api.md#request-rules).

### Second Ingress for MCP in header mode

In oidc mode, `/mcp` and its metadata use the one Ingress. In header mode with MCP on, Claude
cannot pass the proxy login, so those paths need a second Ingress without forward auth. It must:

- route only `/mcp`, `/.well-known/oauth-protected-resource` and
  `/.well-known/oauth-protected-resource/mcp`, each with `pathType: Exact`, because everything on
  it bypasses the proxy;
- set the username header to an empty value, so no client-sent copy reaches sieb on that route.

With Traefik, a headers middleware removes the header by setting it empty:

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

`/mcp` checks bearer tokens itself and ignores both the username header and the session cookie,
see [Endpoint and authentication](reference/mcp.md#endpoint-and-authentication).

## Metrics port

`SIEB_METRICS_PORT` opens a second listener on `SIEB_HOST` that serves `/metrics` and nothing
else. The main port then answers `/metrics` with 404. The port is required in oidc mode and
optional in header mode, where leaving it unset keeps `/metrics` on the main port. The metrics
listener skips the `Host` check, so Prometheus can scrape it by pod IP.

`/metrics` lists CVE ids and image names of your cluster without authentication, so keep it off
the public port. The exported series are listed in
[Health and metrics](operations.md#health-and-metrics).

## Kubernetes manifests

The full set for oidc mode behind one Ingress. Adapt the namespace, hostname, issuer, storage and
the labels your Prometheus and ingress controller select on. [Getting started](getting-started.md)
uses a reduced version of the same set.

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
          image: ghcr.io/bernhardkelm/sieb:<version>
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

`jobLabel` gives the scrape `job="sieb"`, which the silencing rules and the `SiebDown` alert in
[Silencing alerts](prometheus-rules.md#silencing-alerts) expect. With kube-prometheus-stack, the
ServiceMonitor may need the `release` label of your Prometheus.

For header mode, drop `SIEB_AUTH`, the `SIEB_OIDC_*` variables and the Secret, and add the
forward-auth middleware to the Ingress. Without `SIEB_METRICS_PORT`, also drop the `metrics` ports
and point the ServiceMonitor at `port: http`.

## NetworkPolicy

### Ingress

Allow the `http` port from the ingress controller and the `metrics` port from Prometheus. In
header mode this policy is required, since anything that reaches the pod can send its own username
header. In header mode without a metrics port, allow the `http` port from both namespaces.

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

With Auto-check, also allow the worker pod on the worker port. Add this entry to `ingress`:

```yaml
- from:
    - podSelector:
        matchLabels:
          app.kubernetes.io/name: sieb-checker
  ports:
    - port: 3101
```

The worker's own policy is in [Set it up](auto-check.md#set-it-up).

### Egress

If you also restrict egress, sieb needs:

- DNS, the Kubernetes API and Prometheus.
- For the `cisa` KEV source, HTTPS to `www.cisa.gov` or to your mirror.
- In oidc mode or with the Claude connector, HTTPS to the issuer for discovery, the token exchange
  and the key set.
- With Auto-check private access, HTTPS to the registries and git hosts of stored credentials,
  which the **Test** action reaches from sieb itself. For Docker Hub these are
  `registry-1.docker.io` and `auth.docker.io`.
- For own images, HTTPS to their registry and its token service, which the pull probe uses to
  learn whether an image is public.

The credential test and the pull probe connect only to public addresses, never to cluster or
private ones. A registry on an internal name or a private address, such as an in-cluster registry,
cannot be tested or probed from sieb; the Auto-check fetcher still uses its credentials. See
[Image access](reference/api.md#image-access) and
[Access credentials](reference/api.md#access-credentials).

A NetworkPolicy cannot match host names. Either allow port 443 to addresses outside the cluster,
use an egress proxy or a CNI with FQDN policies, or point `SIEB_KEV_URL` at a mirror inside the
cluster. A sketch of the first option; the excluded ranges stand for your private networks:

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
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
              - 100.64.0.0/10
              - 169.254.0.0/16
      ports:
        - port: 443
          protocol: TCP
```

Egress policies add up, so DNS, the API server, Prometheus and an identity provider inside the
cluster go in further policies. An identity provider reached through its public hostname may route
through the ingress controller's address; allow that address too.

## Security checklist

### Both modes

- `SIEB_ALLOWED_HOSTS` contains the public hostname and nothing you do not serve.
- `/metrics` and the worker port are reachable only from inside the cluster.
- Secrets come from Kubernetes Secrets, and the `_FILE` variants are used where they exist.
- The database volume is backed up and protected like a credential store. It holds session and
  token hashes, the ID tokens of open sessions and, with private access, sealed credentials. See
  [Backup and restore](operations.md#backup-and-restore).
- `SIEB_OIDC_REQUIRED_GROUP` and `SIEB_OAUTH_REQUIRED_GROUP` are set where they apply. In
  production sieb warns at start when they are not.
- You know how to revoke a user's tokens and sessions, see
  [Offboarding a user](operations.md#offboarding-a-user).

`/mcp` accepts only bearer tokens, and bearer tokens are never accepted under `/api`. Personal
tokens expire after 30 days, 90 days or one year. Every response carries
`X-Content-Type-Options: nosniff` and `Content-Security-Policy: frame-ancestors 'none'`.

### Header mode

sieb cannot check these. Identity and write protection hold only while they are true:

- The proxy overwrites or strips every client-sent copy of `SIEB_USER_HEADER` on every request.
  With Traefik's forwardAuth middleware, list the header in `authResponseHeaders`.
- The [ingress NetworkPolicy](#ingress) admits only the ingress controller and Prometheus.
- Nothing but `/mcp` and its two metadata paths bypasses the proxy. Most read routes answer
  without a user in this mode, and they list the CVEs and images of your cluster.
- `SIEB_METRICS_PORT` is set, so `/metrics` leaves the public port.

### OIDC mode

- Everything needs a session except `/auth/*`, `/api/health`, the icons and web manifest of the
  client and, with MCP on, `/mcp` and `/.well-known/oauth-protected-resource*`, which take bearer
  tokens.
- `/metrics` is served only on `SIEB_METRICS_PORT`, and the username header has no effect.
- Sessions have an absolute lifetime and are stored as sha-256 hashes. The cookies are HttpOnly,
  SameSite=Lax and `__Host-` prefixed over https, so a sibling subdomain cannot plant them.
- Removing a user from the group stops new logins at once. The refused login also ends the user's
  sessions, fails their open Auto-checks and revokes their tokens. Until they try, a running
  session lasts until it expires.

Each session stores the ID token it was opened with, because the logout sends it to the provider
as `id_token_hint`. The ID token states who signed in; sieb accepts it nowhere as a credential,
and it is deleted with the session.

## Optional features

### Claude integration

Off by default. Set `SIEB_MCP_ENABLED=true` and `SIEB_PUBLIC_URL`, and for the claude.ai connector
the `SIEB_OAUTH_*` variables of a second identity provider client. In header mode add the
[second Ingress](#second-ingress-for-mcp-in-header-mode). See
[Turn it on](working-with-claude.md#turn-it-on) and [Connect](working-with-claude.md#connect).

### Auto-check

Off by default. It needs the Claude integration, `SIEB_CHECKS_ENABLED=true`, a worker port on the
Service and the worker Deployment. Private images and source code also need
`SIEB_CREDENTIALS_KEY` and `SIEB_FETCHER_SECRET`. See [Set it up](auto-check.md#set-it-up) and
[Private access](auto-check.md#private-access).

## See also

- [Prometheus rules](prometheus-rules.md): the findings rule, silencing rules and alerts
- [Operations](operations.md): backups, upgrades, rotation and troubleshooting
- [Configuration](reference/configuration.md): every variable and the start-up rules
