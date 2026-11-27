# Prometheus rules

This guide is for operators who connect sieb to Prometheus. It covers the rule sieb reads its
findings from, the optional KEV rule, the rules that silence decided findings, and alerts for sieb
itself and for Auto-check.

Two rule sets are required. The findings rule feeds sieb, and without it sieb has nothing to show.
The two silencing rules make decisions mute your alerts. Everything else is optional: exposure and
owner labels, the KEV rule (only with `SIEB_KEV_SOURCE=prometheus`) and the alerts on sieb and
Auto-check.

The rules below are examples. Adapt names, registries and the exposure source to your cluster.
With kube-prometheus-stack, a `PrometheusRule` needs the `release` label of your Prometheus unless
you changed its rule selector.

On this page

- [Prerequisites](#prerequisites)
- [Findings query](#findings-query)
- [KEV query](#kev-query)
- [Silencing alerts](#silencing-alerts)
- [Auto-check alerts](#auto-check-alerts)

## Prerequisites

- The Trivy Operator with the per-CVE metric, `operator.metricsVulnIdEnabled: true` in its Helm
  values. It exposes `trivy_vulnerability_id` with `namespace`, `resource_kind`, `resource_name`,
  `image_registry`, `image_repository`, `vuln_id`, `vuln_score` and `severity`.
- `trivy.ignoreUnfixed: true` if only fixable findings should reach sieb and your alerts.
- Prometheus scraping the operator, for example through its ServiceMonitor.

## Findings query

sieb reads the findings query and joins its series with the VulnerabilityReports of the Trivy
Operator. Prometheus decides what counts as a finding: a report entry without a matching series is
dropped, and the series wins for severity, score, exposure and owner. That lets you filter, for
example to fixable findings, and re-rate in PromQL, where your alerts already live.

The query is `SIEB_FINDINGS_QUERY`, default `sieb:trivy_finding:info`, with one series per workload
and CVE:

| Label | Required | Meaning |
| --- | --- | --- |
| `namespace`, `resource_kind`, `resource_name` | yes | The workload, as in the Trivy Operator labels |
| `image_ref` | yes | `image_registry` + `/` + `image_repository`, no tag, such as `index.docker.io/library/nginx` |
| `vuln_id` | yes | CVE or advisory id |
| `severity` | no | `Critical`, `High`, `Medium`, `Low` or `Unknown`, in any case. Default `Unknown` |
| `vuln_score` | no | CVSS base score |
| `severity_source` | no | Set only on re-rated series, shown next to the severity, such as `cvss` |
| `exposure` | no | `public`, `gated` or `internal`, in any case. Missing or unrecognized means unknown |
| `owner` | no | Free text. `self` marks your own images and sorts first, other values sort alphabetically |

Series without a required label are skipped. When the query returns nothing while the reports list
vulnerabilities, the sync fails and resolves nothing, since that means a missing rule or lost
Prometheus data.

`exposure` and `owner` are independent of each other. An owner value is trimmed and must be at most
64 characters without commas or control characters; anything else counts as no owner. While no
open finding carries one of the two labels, sieb hides its column, filter and chips. How sieb uses
both is in [Exposure and owner](triage.md#exposure-and-owner).

### Exposure tiers

Label each workload by how it can be reached from outside the cluster, not by how its app
authenticates:

| Tier | Reach |
| --- | --- |
| `public` | Reachable from the internet with no gate in front. The app's own login does not count as a gate |
| `gated` | A gate in front of the app, such as a forward-auth proxy or an IP allowlist, decides who reaches it at all |
| `internal` | No route from outside the cluster, reachable only from other pods and nodes |

A workload without the label is unknown. Triage ranks it after `gated` and before `internal`,
since it may be reachable. Exposure describes the network entry only: it does not lower the risk
of flaws triggered by processed data, such as uploaded files or parsed images.

### Minimal rule

Enough to run sieb. Without exposure and owner, the UI shows neither.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: sieb-findings
  namespace: monitoring
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

### Rule with exposure and owner

Exposure comes from an info metric you maintain, `workload_exposure:info{namespace, resource_kind,
resource_name, exposure}`, for example derived from your Ingresses, Services and pods. Workloads
without an entry keep no `exposure` label and show as unknown. Add them to the info metric as
`internal` once you know they are.

Owner is set from `image_ref`. Each `label_replace` writes only when its regex matches, and later
calls win, so the generic fallback comes first. Add one call per owner value you want. Below,
images from your own registry are `self` and the cluster add-ons are `platform`. Without the
fallback, unmatched images have no owner.

```yaml
- record: sieb:trivy_finding:info
  expr: |
    group by (namespace, resource_kind, resource_name, image_ref, owner, exposure, vuln_id, vuln_score, severity) (
      label_replace(
        label_replace(
          label_replace(
            label_join(
              trivy_vulnerability_id
              * on (namespace, resource_kind, resource_name) group_left (exposure)
              workload_exposure:info
              or
              (
                trivy_vulnerability_id
                unless on (namespace, resource_kind, resource_name)
                workload_exposure:info
              ),
              "image_ref", "/", "image_registry", "image_repository"
            ),
            "owner", "third-party", "", ""
          ),
          "owner", "platform", "image_ref", `registry\.example\.com/platform/.*`
        ),
        "owner", "self", "image_ref", `registry\.example\.com/acme/.*`
      )
    )
```

## KEV query

sieb reads this query only with `SIEB_KEV_SOURCE=prometheus`. By default (`cisa`) sieb downloads
the CISA catalog itself and needs no KEV rule, see [KEV source](deployment.md#kev-source). The
Prometheus source suits clusters without egress to `www.cisa.gov` that already scrape the
catalog. It provides only the flag, so the finding panel shows no catalog details.

The query is `SIEB_KEV_QUERY`, default `sieb:kev:listed`, with one series per `vuln_id` listed in
the [CISA Known Exploited Vulnerabilities](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
catalog. The catalog holds well over a thousand entries, so an empty result fails the sync instead
of reporting every finding as not listed.

One way to get it is the
[prometheus-json-exporter](https://github.com/prometheus-community/helm-charts/tree/main/charts/prometheus-json-exporter)
chart scraping the CISA feed. Its Helm values:

```yaml
configuration:
  config: |
    ---
    modules:
      kev:
        metrics:
          - name: kev_vulnerability
            type: object
            valuetype: gauge
            help: CVE listed in the CISA Known Exploited Vulnerabilities catalog
            path: '{.vulnerabilities[*]}'
            labels:
              vuln_id: '{.cveID}'
            values:
              listed: 1
        http_client_config:
          follow_redirects: true

serviceMonitor:
  enabled: true
  targets:
    - name: cisa-kev
      url: https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json
      module: kev
      interval: 1h
      scrapeTimeout: 60s
```

The hourly scrape is longer than the five-minute lookback, so the rule keeps the series
continuous:

```yaml
- record: sieb:kev:listed
  expr: max by (vuln_id) (last_over_time(kev_vulnerability_listed[3h]))
```

Your alerts can join on `sieb:kev:listed` whatever `SIEB_KEV_SOURCE` is set to.

## Silencing alerts

sieb exports `sieb_suppressed{vuln_id, image_ref} 1` for every open finding governed by an
effective decision: `not_affected` or `accepted`, and neither revoked, expired nor re-opened. A
decision for all images of a CVE expands to one series per image the CVE is found in, so an image
with its own expired or re-opened decision stays unsilenced. Images where the CVE newly appears
are covered from the next sync on. What the statuses mean for users is in
[How decisions mute alerts](triage.md#how-decisions-mute-alerts).

The rules below rely on this contract:

- `vuln_id` and `image_ref` equal the labels of `sieb:trivy_finding:info` exactly.
- The rules test only for presence. sieb never exports a `0`; a decision ends by its series
  disappearing.
- The rules match only on `vuln_id` and `image_ref`, so target labels are ignored and `group by`
  folds duplicates, for example the old and new pod during a rollout.

Scrape sieb directly, through its Service or pod and not through the Ingress, with the job name
`sieb`. In oidc mode, and whenever `SIEB_METRICS_PORT` is set, scrape the metrics port; the main
port then answers 404. See [Metrics port](deployment.md#metrics-port) and the ServiceMonitor in
[Kubernetes manifests](deployment.md#kubernetes-manifests).

### Recording rules

Put both rules in the group of the findings rule, directly after it and in this order. Rules in a
group run in order, so each sees the current result of the ones above it.

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
        unless on (namespace, resource_kind, resource_name, image_ref, vuln_id, exposure)
        sieb:trivy_finding:info
      )
    )
    unless on (vuln_id, image_ref)
    sieb:suppressed:effective
```

`sieb:suppressed:effective` works like this:

- While a sieb target is up, it is the live `sieb_suppressed`, so accepting, revoking and expiry
  reach the rules with the next scrape.
- While no target is up, because the scrape fails or the target is gone, it returns its own
  previous result. Decisions revoked before the outage stay revoked, which
  `last_over_time(sieb_suppressed[6h])` would undo.
- `max_over_time(up{job="sieb"}[6h]) == 1` ends the hold six hours after the last successful
  scrape.
- Without any sieb series and any sieb target the result is empty, so the rules are safe to add
  before sieb runs.

`sieb:trivy_finding_open:info` works like this:

- `last_over_time(...[1h])` keeps a finding for one hour after its last sample. This bridges
  reports that the scanner deletes and recreates, rescans and short scrape outages, so the alerts
  need no `keep_firing_for`. Adjust the window to the gaps you measure.
- A bridged series is dropped as soon as the same finding is live again. Rescans can change
  `vuln_score` and the derived `severity`, and without the `unless` both would be counted.
- `exposure` stays in the match so a workload that changes tier leaves no short gap. Drop it from
  the match if your findings rule has no `exposure` label.

### Alerts

Point every alert or report query that should respect decisions at
`sieb:trivy_finding_open:info`. If those alerts use `keep_firing_for` to ride out rescans, drop
it; the bridge window of the open rule covers that. This example fires for a KEV listed CVE with a
public instance. Without a KEV rule, drop the `and on (vuln_id)` part:

```yaml
- alert: TrivyKnownExploitedPublic
  expr: |
    count by (vuln_id) (
      sieb:trivy_finding_open:info{exposure="public"} and on (vuln_id) sieb:kev:listed
    )
  for: 30m
```

### Timing

Scrape and rule evaluation intervals set the pace; assume about 30 seconds each.

| Event | Effect |
| --- | --- |
| A decision becomes effective | Silenced within one to two minutes. A pending alert does not fire, a firing alert resolves |
| A decision is revoked, expires or re-opens | The finding is back within one to two minutes, the alert fires after its `for` |
| sieb is down or its target is gone | The last live set holds for up to six hours after the last successful scrape, then silenced findings alert again after their `for` |
| sieb is up but `/metrics` lacks series | The missing findings are unsilenced at once. This fails open and can cost one notification per affected CVE |
| A report is recreated or rescanned within the bridge window | Bridged, the alert keeps firing without a resolved and firing pair |
| A finding is fixed | It leaves the open rule after the bridge window of one hour, and the alert resolves then |

### Rollout

- Evaluate the two recording rules in the group of the findings rule. If the alert rules sit in
  another group, that group may evaluate once before the open rule has its first result. Without
  `keep_firing_for`, firing alerts then resolve and fire again after their `for`.
- If alerts already fire, create a short Alertmanager silence for them, for example 45 minutes,
  before you apply the rules.

### SiebDown

If sieb stops being scraped, the held set lapses six hours after the last scrape and every
silenced finding alerts again. Warn before that happens:

```yaml
- alert: SiebDown
  expr: |
    (up{job="sieb"} == 0 or absent(up{job="sieb"}))
    and on ()
    present_over_time(up{job="sieb"}[7d])
  for: 30m
  labels:
    severity: warning
  annotations:
    summary: sieb is not scraped, silenced findings alert again six hours after the last scrape
```

The `present_over_time` gate keeps the alert silent until sieb has been scraped once. It resolves
seven days after the last scrape; delete the rule when you remove sieb for good.

## Auto-check alerts

With [Auto-check](auto-check.md) on, sieb also exports its check queue, listed in
[Health and metrics](operations.md#health-and-metrics). `sieb_check_worker_online` exists only
while `SIEB_CHECKS_ENABLED` is on, so the first alert stays silent on installs without Auto-check.
The second catches a queue that does not move, for example a worker that polls but cannot claim:

```yaml
- alert: SiebCheckWorkerOffline
  expr: sieb_check_worker_online == 0
  for: 15m
  labels:
    severity: warning

- alert: SiebChecksStuck
  expr: |
    sieb_checks_open{state="queued"} > 0
    and on ()
    sieb_checks_open{state="running"} == 0
  for: 1h
  labels:
    severity: warning
```

Neither fires while sieb itself is not scraped; [SiebDown](#siebdown) covers that. The worker runs
one check at a time, so a long queue alone does not fire `SiebChecksStuck` as long as a check is
running.

Two queries help with reports. The average run time over a week:

```promql
increase(sieb_check_duration_seconds_sum[7d]) / increase(sieb_check_duration_seconds_count[7d])
```

The failed checks of a week:

```promql
increase(sieb_checks_finished_total{status="failed"}[7d])
```

## See also

- [Getting started](getting-started.md): the minimal findings rule and the first silenced alert
- [How decisions mute alerts](triage.md#how-decisions-mute-alerts): which decisions silence what,
  from the user's side
- [Health and metrics](operations.md#health-and-metrics): every series sieb exports
- [Deployment](deployment.md#metrics-port): the metrics port and the ServiceMonitor
