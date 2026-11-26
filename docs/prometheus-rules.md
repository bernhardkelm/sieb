# Prometheus rules

sieb reads the findings query, plus the KEV query with `SIEB_KEV_SOURCE=prometheus`, and joins the
findings with the `VulnerabilityReport` resources of the Trivy Operator. Prometheus decides what
counts as a finding: report entries without a matching series are dropped, and the series wins for
severity, score, exposure and owner. That lets you filter (for example to fixable findings only) and
re-rate in PromQL, where your alerts already live.

The rules below are examples. Adapt names, registries and the exposure source to your cluster.

## Prerequisites

- Trivy Operator with the per-CVE metric enabled, `operator.metricsVulnIdEnabled: true` in the Helm
  values. It exposes `trivy_vulnerability_id` with `namespace`, `resource_kind`, `resource_name`,
  `image_registry`, `image_repository`, `vuln_id`, `vuln_score` and `severity`.
- `trivy.ignoreUnfixed: true` if only fixable findings should reach sieb and your alerts.
- Prometheus scraping the operator, for example through its ServiceMonitor.

## Findings query

`SIEB_FINDINGS_QUERY`, default `sieb:trivy_finding:info`. One series per workload and CVE.

| Label | Required | Meaning |
| --- | --- | --- |
| `namespace`, `resource_kind`, `resource_name` | yes | Workload, as in the Trivy Operator labels |
| `image_ref` | yes | `image_registry` + `/` + `image_repository`, no tag, e.g. `index.docker.io/library/nginx` |
| `vuln_id` | yes | CVE or advisory id |
| `severity` | no | `Critical`, `High`, `Medium`, `Low`, `Unknown` (case-insensitive), default `Unknown` |
| `vuln_score` | no | CVSS base score |
| `severity_source` | no | Set only on re-rated series, shown as the re-rating source next to the severity, e.g. `cvss` |
| `exposure` | no | `public`, `gated` (behind authentication) or `internal` (case-insensitive). Missing or unrecognised means unknown |
| `owner` | no | Free-form text. `self` marks your own images and sorts first, every other value is shown as it is, sorted alphabetically. Missing means no owner |

Series without one of the required labels are skipped. A sync fails, and resolves nothing, when
this query returns nothing while the reports list vulnerabilities, since that means a missing rule
or lost Prometheus data.

`exposure` and `owner` are optional and independent of each other:

- Unknown exposure is not treated as `internal`. Triage ranks it after `gated` and before
  `internal`, since such a workload may be reachable. While no open finding has an `exposure`
  label, sieb hides the exposure column, filter and chip and the "Public" overview stat, and
  Triage ranks by KEV listing, severity and score only.
- Owner values are trimmed and must be at most 64 characters without commas or control
  characters, other values count as no owner. The owner filter offers the values present in the
  open findings. While no open finding has an `owner` label, sieb hides the owner column and
  filter.

### Minimal rule

Enough to run sieb: no exposure and no owner, so the UI shows neither.

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
without an entry keep no `exposure` label and show as unknown; add them to the info metric as
`internal` once you know they are.

Owner is set from `image_ref`. Each `label_replace` only writes when its regex matches, and later
calls win, so the generic fallback comes first. Add one call per owner value you want, any text
works: below, images from your own registry are `self` and the cluster add-ons are `platform`.
Without the fallback, unmatched images have no owner.

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

Only read with `SIEB_KEV_SOURCE=prometheus`. By default (`cisa`) sieb fetches the CISA feed itself
and needs no KEV rule, see [api.md](api.md#kev-source); `none` runs without KEV. The Prometheus
source suits clusters without egress to `www.cisa.gov` that already scrape the catalog, but it only
provides the flag, so the finding panel shows no catalog details.

`SIEB_KEV_QUERY`, default `sieb:kev:listed`. One series per `vuln_id` listed in the
[CISA Known Exploited Vulnerabilities](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
catalog. The catalog holds well over a thousand entries, so an empty result fails the sync instead
of reporting every finding as not KEV listed.

One way to get it is the
[prometheus-json-exporter](https://github.com/prometheus-community/helm-charts/tree/main/charts/prometheus-json-exporter)
chart scraping the CISA feed. Helm values:

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

The hourly scrape is longer than the 5m lookback, so the rule keeps the series continuous:

```yaml
- record: sieb:kev:listed
  expr: max by (vuln_id) (last_over_time(kev_vulnerability_listed[3h]))
```

## Silencing alerts

sieb exports `sieb_suppressed{vuln_id, image_ref} 1` for every open finding governed by an
effective decision (`not_affected` or `accepted`, not revoked, expired or re-opened). A decision for
all images of a CVE expands to one series per image the CVE is currently found in, so an image with
its own expired or re-opened decision stays unsilenced. Images where the CVE newly appears are
covered from the next sync on.

Contract for the rules below:

- `vuln_id` and `image_ref` must equal the labels of `sieb:trivy_finding:info` exactly.
- The rules only test for presence. sieb never exports a `0` or a series for a decision that is not
  effective, a decision ends by its series disappearing.
- The rules match only on `vuln_id` and `image_ref`, so target labels are ignored and `group by`
  folds duplicates, for example old and new pod during a rollout.

Scrape sieb directly (Service or pod, not through the authenticated ingress) with the job name
`sieb`, then add two recording rules. With `SIEB_METRICS_PORT` set, which oidc mode requires,
`/metrics` is served only on that port and the main port answers 404, so scrape the metrics port;
see [Metrics port](deployment.md#metrics-port) and the ServiceMonitor in
[deployment.md](deployment.md#kubernetes).

### Recording rules

Put both in the same group as the findings rule, directly after it and in this order. Rules in a
group run in order, so each sees the current evaluation of the ones above it.

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

`sieb:suppressed:effective`:

- While a sieb target is up, it is the live `sieb_suppressed`, so accept, revoke and expiry reach the
  rules on the next scrape.
- While no target is up (scrape fails or target gone), it returns its own previous result. Decisions
  revoked before the outage stay revoked, which `last_over_time(sieb_suppressed[6h])` would undo.
- `max_over_time(up{job="sieb"}[6h]) == 1` ends the hold 6h after the last successful scrape.
- Without any sieb series and without a sieb target the result is empty, so the rules are safe to
  add before sieb runs.

`sieb:trivy_finding_open:info`:

- `last_over_time(...[1h])` keeps a finding for 1h after its last sample. This bridges reports that
  the scanner deletes and recreates, rescans and short scraper outages, so the alerts need no
  `keep_firing_for`. Adjust the window to the gaps you measure.
- A bridged series is dropped as soon as the same finding is live again. Rescans can change
  `vuln_score` and the derived `severity`, and without the `unless` both would be counted.
- `exposure` stays in the match so a workload that changes tier does not leave a short gap in
  "CVE has a public instance". Drop it from the match if your findings rule has no `exposure` label.

### Alerts

Point every alert or report query that should respect decisions at `sieb:trivy_finding_open:info`.
If those alerts use `keep_firing_for` to ride out rescans, drop it, the bridge window of the open
rule covers that. The example below joins on the `sieb:kev:listed` rule from [KEV query](#kev-query), which your alerts
can use whatever `SIEB_KEV_SOURCE` is set to; without it, drop the `and on (vuln_id)` part:

```yaml
- alert: TrivyKnownExploitedPublic
  expr: |
    count by (vuln_id) (
      sieb:trivy_finding_open:info{exposure="public"} and on (vuln_id) sieb:kev:listed
    )
  for: 30m
```

### Timing

Scrape and rule evaluation intervals define "next evaluation", assume about 30s each.

| Event | Effect |
| --- | --- |
| Decision becomes effective | Silenced within 1 to 2 minutes. A pending alert does not fire, a firing alert resolves. |
| Decision revoked, expired or re-opened | The finding is back within 1 to 2 minutes, the alert fires after its `for`. |
| sieb down or target gone | The last live set is held for up to 6h after the last successful scrape, then silenced findings alert again after their `for`. |
| sieb up but `/metrics` lacks series | The missing findings are un-silenced at once. This fails open and can cost one notification per affected CVE. |
| Report recreated or rescanned within the bridge window | Bridged, the alert keeps firing without a resolved and firing pair. |
| Finding fixed | Leaves the open rule after the bridge window (1h), the alert resolves then. |

### Rollout

- Evaluate the two recording rules in the group of the findings rule. If the alert rules sit in
  another group, it may evaluate once before the open rule has its first result. Without
  `keep_firing_for`, firing alerts then resolve and fire again after their `for`.
- If alerts already fire, create a short Alertmanager silence for them (for example 45m) before
  applying the rules.

### SiebDown

If sieb stops being scraped, the held set lapses 6h after the last scrape and every silenced
finding alerts again. Warn before that happens:

```yaml
- alert: SiebDown
  expr: |
    (up{job="sieb"} == 0 or absent(up{job="sieb"}))
    and on ()
    present_over_time(up{job="sieb"}[7d])
  for: 30m
  labels:
    severity: warning
```

The `present_over_time` gate keeps the alert silent until sieb has been scraped once. It resolves 7
days after the last scrape, delete the rule when sieb is removed for good. Add the annotation that
accepted findings may alert again after 6h.
