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

## Kubernetes

Example manifests, adapt namespace, hostname, storage and the labels of your Prometheus and ingress
controller. SQLite allows one writer, so keep one replica and the `Recreate` strategy.

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
          image: ghcr.io/bernhardkelm/sieb:0.0.1
          env:
            - name: NODE_EXTRA_CA_CERTS
              value: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
            - name: SIEB_ALLOWED_HOSTS
              value: sieb.example.com
            - name: SIEB_PROMETHEUS_URL
              value: http://kube-prometheus-stack-prometheus.monitoring.svc:9090
          ports:
            - name: http
              containerPort: 3100
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
    - port: http
      path: /metrics
```

`jobLabel` sets `job="sieb"`, which the `SiebDown` example in
[prometheus-rules.md](prometheus-rules.md#silencing-alerts) expects. Depending on your
kube-prometheus-stack values, the ServiceMonitor may need the `release` label of your Prometheus.

Expose the UI through an Ingress behind your forward-auth proxy, see below. Prometheus scrapes the
Service directly.

## Security

sieb has no login of its own. It trusts the username header (`SIEB_USER_HEADER`, default
`X-authentik-username`) set by a forward-auth proxy in front of it. Not enforced by code, required
for identity and write protection to hold:

- The proxy must overwrite or strip any client-sent copy of that header on every request. With
  Traefik's forwardAuth middleware, list the header in `authResponseHeaders`. With other proxies,
  set `SIEB_USER_HEADER` to the header they set, for example `X-Auth-Request-User` for oauth2-proxy,
  and make sure they strip incoming copies.
- A NetworkPolicy must allow ingress to the sieb pod only from the ingress controller and from
  Prometheus, so nothing else can reach the pod and send its own username header:

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
          - namespaceSelector:
              matchLabels:
                kubernetes.io/metadata.name: monitoring
        ports:
          - port: http
  ```

  If you also restrict egress, allow DNS, the Kubernetes API, Prometheus and, for the `cisa` KEV
  source, HTTPS to `www.cisa.gov`. A NetworkPolicy cannot match host names, so either allow port
  443 to addresses outside the cluster, use an egress proxy or a CNI with FQDN policies, or point
  `SIEB_KEV_URL` at a mirror inside the cluster. A sketch of the first option, the CIDRs are
  placeholders for your pod and service ranges:

  ```yaml
  apiVersion: networking.k8s.io/v1
  kind: NetworkPolicy
  metadata:
    name: sieb-egress-kev
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

  Egress policies add up, so the rules for DNS, the API server and Prometheus go in further
  policies.

- `SIEB_ALLOWED_HOSTS` must contain the public hostname. Every other `Host` is refused (DNS
  rebinding protection), except on `/metrics` and `/api/health`, which Prometheus and the kubelet
  reach by pod IP.
- `/metrics` and the read routes need no user. They list CVE ids and image names of your cluster, so
  never expose sieb without the forward-auth proxy in front of it.
- Writes require `Content-Type: application/json` and a same-origin request, see [api.md](api.md).
