# Getting started

This guide takes you from a cluster with the Trivy Operator to a running sieb whose decisions
silence your Prometheus alerts. It takes five steps: a findings rule, the sieb deployment, the
first sync, the silencing rules, and your first decision. Everything here works without Claude;
connecting it comes afterwards.

On this page

- [What you need](#what-you-need)
- [Step 1: add the findings rule](#step-1-add-the-findings-rule)
- [Step 2: deploy sieb](#step-2-deploy-sieb)
- [Step 3: run the first sync](#step-3-run-the-first-sync)
- [Step 4: silence decided findings](#step-4-silence-decided-findings)
- [Step 5: decide your first finding](#step-5-decide-your-first-finding)
- [Next](#next)

## What you need

- A Kubernetes cluster with the [Trivy Operator](https://github.com/aquasecurity/trivy-operator)
  and the per-CVE metric turned on: `operator.metricsVulnIdEnabled: true` in its Helm values.
  Prometheus must scrape the operator, for example through the chart's ServiceMonitor
  (`serviceMonitor.enabled: true`).
- Prometheus with the Prometheus Operator, for example
  [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack),
  so `PrometheusRule` and `ServiceMonitor` resources work.
- An OpenID Connect identity provider for the login, such as authentik, Keycloak or Dex. A
  forward-auth proxy works too, see [Authentication](deployment.md#authentication).
- A hostname with TLS for the Ingress, `sieb.example.com` below.
- Outbound HTTPS from the sieb pod to `www.cisa.gov` for the KEV catalog. Without it, pick another
  [KEV source](deployment.md#kev-source).

Two Trivy Operator settings are optional. `trivy.ignoreUnfixed: true` keeps unfixable findings out
of sieb and your alerts. `trivy.additionalVulnerabilityReportFields` with `Target`, `Class`,
`PackageType` and `PackagePath` lets sieb show where in the image a package was found.

To look at sieb before you deploy it, run it with its built-in fixtures and open
`http://localhost:3100`:

```sh
docker run --rm -p 3100:3100 -e NODE_ENV= -e SIEB_SOURCE=mock \
  -e SIEB_DB_PATH=/data/sieb-mock.db ghcr.io/bernhardkelm/sieb:latest
```

## Step 1: add the findings rule

sieb reads its findings from one recording rule. Prometheus decides what counts as a finding, so
you can filter and re-rate in PromQL later. This minimal rule is enough to start. Apply it in the
namespace of your Prometheus:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: sieb-findings
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  groups:
    - name: sieb-findings
      rules:
        - record: sieb:trivy_finding:info
          expr: |
            group by (namespace, resource_kind, resource_name, image_ref, vuln_id, vuln_score, severity) (
              label_join(trivy_vulnerability_id, "image_ref", "/", "image_registry", "image_repository")
            )
```

kube-prometheus-stack picks up rules and ServiceMonitors by its `release` label unless you changed
its selectors. Use the name of your release. After the next rule evaluation, the query
`sieb:trivy_finding:info` in Prometheus returns one series per workload and CVE.

The full label contract, exposure and owner labels and the KEV rule are in
[Findings query](prometheus-rules.md#findings-query).

## Step 2: deploy sieb

sieb runs as one pod with a SQLite database on a volume. It signs users in through your identity
provider itself, so one plain Ingress is enough.

1. Create a confidential OpenID Connect client at your identity provider. Redirect URI
   `https://sieb.example.com/auth/callback`, post-logout redirect URI `https://sieb.example.com/`,
   scopes `openid`, `profile` and `email`, and an RSA or EC signing key. The full checklist is in
   [Identity provider checklist](deployment.md#identity-provider-checklist).
2. Create the namespace and a Secret with the client's id and secret:

   ```sh
   kubectl create namespace sieb
   kubectl -n sieb create secret generic sieb-oidc \
     --from-literal=client-id=<client id> \
     --from-literal=client-secret=<client secret>
   ```

3. Apply the manifests below. Replace the hostname, the issuer and the image tag, and adapt the
   storage and the ingress class to your cluster. `<version>` is a release such as the latest on
   the [releases page](https://github.com/bernhardkelm/sieb/releases).

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
        fsGroup: 1000
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
            - name: SIEB_METRICS_PORT
              value: "9100"
            - name: SIEB_AUTH
              value: oidc
            - name: SIEB_OIDC_ISSUER
              value: https://idp.example.com/application/o/sieb/
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
  labels:
    release: kube-prometheus-stack
spec:
  jobLabel: app.kubernetes.io/name
  selector:
    matchLabels:
      app.kubernetes.io/name: sieb
  endpoints:
    - port: metrics
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

The issuer is the URL your provider shows for the client, exactly, including a trailing slash if
it has one. The Prometheus URL defaults to the kube-prometheus-stack service in `monitoring`; set
`SIEB_PROMETHEUS_URL` if yours differs. The pod log shows `[sieb] listening on` and
`[sieb] auth mode oidc` once it is up. If it exits instead, the last log line names the variable
that is missing or wrong.

## Step 3: run the first sync

Open `https://sieb.example.com` and sign in. sieb syncs once at start and then every 15 minutes.
The **Sync** button in the header starts one at once. A green dot next to it means the last sync
succeeded; hover it for the time and, after a failure, the error.

The Triage list now shows every open finding without a decision, ranked by KEV listing and
severity. An empty list has one of three causes:

- The sync failed with `sieb:trivy_finding:info is empty while reports list N vulnerabilities`.
  The findings rule is missing or not loaded yet. Check Step 1 and wait for one rule evaluation.
- The sync failed with a 403 from the Kubernetes API. The ClusterRole or its binding is missing.
- The sync succeeded and found nothing. The Trivy Operator has not written any
  VulnerabilityReports yet, or none lists a vulnerability.

More symptoms and fixes are in [Troubleshooting](operations.md#troubleshooting).

## Step 4: silence decided findings

sieb exports one `sieb_suppressed` series for every open finding that a decision silences.
Prometheus already scrapes it through the ServiceMonitor of Step 2. Two recording rules turn that
into the findings your alerts should see. Append them to the `rules` of the `sieb-findings` group
from Step 1, directly after the findings rule and in this order:

```yaml
- record: sieb:suppressed:effective
  expr: |
    group by (vuln_id, image_ref) (
      sieb_suppressed
      or
      (
        sieb:suppressed:effective
        unless on () (up{job="sieb"} == 1)
        and on () (max_over_time(up{job="sieb"}[6h]) == 1)
      )
    )
- record: sieb:trivy_finding_open:info
  expr: |
    (
      sieb:trivy_finding:info
      or
      (
        last_over_time(sieb:trivy_finding:info[1h])
        unless on (namespace, resource_kind, resource_name, image_ref, vuln_id)
        sieb:trivy_finding:info
      )
    )
    unless on (vuln_id, image_ref)
    sieb:suppressed:effective
```

Then point an alert at the open rule instead of the raw Trivy metric. This one fires for every
critical finding that nobody has decided:

```yaml
- alert: TrivyCriticalFinding
  expr: count by (vuln_id, image_ref) (sieb:trivy_finding_open:info{severity="Critical"}) > 0
  for: 30m
  labels:
    severity: warning
```

The first rule holds the last known set for up to six hours while sieb is not scraped, so a
restart does not wake everyone. The second bridges short gaps when the operator rescans. Once your
findings rule carries an `exposure` label, add `exposure` to the first `unless on (...)` list of
the second rule. Why each part is there, the timing and a `SiebDown` alert are in
[Silencing alerts](prometheus-rules.md#silencing-alerts).

## Step 5: decide your first finding

1. In Triage, open a critical finding that the alert above fires for.
2. Read the panel: the affected images and workloads, the KEV details and where the package was
   found.
3. Under **Status**, choose **Not affected** or **Accepted**, write a **Reason** and select
   **Save decision**.

The finding leaves Triage. Within one to two minutes, Prometheus shows the decision:

```promql
sieb_suppressed{vuln_id="<the CVE id>"}
```

The alert for that CVE and image resolves, or does not fire if it was still pending. **Fix
planned** keeps the alert on purpose: it moves the finding out of Triage but leaves the risk
visible. What each status does, expiry and re-opening are explained in
[Decisions](triage.md#decisions).

## Next

- [Working with Claude](working-with-claude.md): let Claude investigate findings and propose
  decisions you review in the Inbox. Optional and off by default.
- [Auto-check](auto-check.md): run those investigations inside the cluster.
- [Deployment](deployment.md): header mode, the NetworkPolicy and the
  [Security checklist](deployment.md#security-checklist) before you rely on sieb.
- [Operations](operations.md): back up the database and plan upgrades.
