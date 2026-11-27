# Operations

This guide is for operators who keep sieb running after the first deployment. It covers health
and metrics, the logs, backups, upgrades, secret rotation, offboarding and the problems you are
most likely to meet. The commands assume the namespace `sieb` and the manifests of
[Kubernetes manifests](deployment.md#kubernetes-manifests).

On this page

- [Health and metrics](#health-and-metrics)
- [Logs](#logs)
- [Backup and restore](#backup-and-restore)
- [Upgrades](#upgrades)
- [Secrets and rotation](#secrets-and-rotation)
- [Offboarding a user](#offboarding-a-user)
- [KEV catalog health](#kev-catalog-health)
- [Troubleshooting](#troubleshooting)

## Health and metrics

`GET /api/health` answers `{"status":"ok","source":"incluster"}` without authentication and
without a `Host` check, for the kubelet's probes and the image's health check.

`GET /metrics` serves the Prometheus text format without authentication, on `SIEB_METRICS_PORT`
when it is set, see [Metrics port](deployment.md#metrics-port):

| Series | Type | Meaning |
| --- | --- | --- |
| `sieb_suppressed{vuln_id, image_ref}` | gauge | `1` for every open finding a decision silences, see [Silencing alerts](prometheus-rules.md#silencing-alerts) |
| `sieb_last_sync_timestamp_seconds` | gauge | Unix time the latest finished sync ended, successful or not. Absent before the first one |
| `sieb_last_sync_success` | gauge | `1` when the latest finished sync succeeded, else `0` |
| `sieb_findings_open` | gauge | Findings not resolved by the latest successful sync |
| `sieb_decisions{state}` | gauge | Decisions per state: `active`, `fix_planned`, `expired`, `reopened`, `revoked` |
| `sieb_checks_open{state}` | gauge | Auto-checks `queued` and `running` |
| `sieb_checks_finished_total{status}` | counter | Every check that ever ended, by `done`, `failed` and `cancelled` |
| `sieb_check_duration_seconds` | summary | `_sum` and `_count` over done and failed checks, no quantiles |
| `sieb_check_worker_online` | gauge | `1` while the worker reached sieb within the last 90 seconds. Only with `SIEB_CHECKS_ENABLED` |

Alerts for an unscraped sieb, an offline worker and a stuck queue are in
[Prometheus rules](prometheus-rules.md#auto-check-alerts). A useful extra alert fires when syncs
keep failing:

```yaml
- alert: SiebSyncFailing
  expr: sieb_last_sync_success == 0
  for: 1h
  labels:
    severity: warning
```

## Logs

sieb logs to stdout and stderr, one line per event, each starting with `[sieb]`. It writes no
access log. Lines you will see:

- Start: the listeners, the source, the KEV source and the auth mode, warnings about unset
  required groups, and with Auto-check whether private access is on.
- Every sync with its counts of seen, new, resolved and reappeared findings, or its error.
- KEV catalog refreshes, stored or failed, see [KEV catalog health](#kev-catalog-health).
- Logins, failed logins with the reason, logouts, and users refused for a missing group.
- Personal tokens created, revoked and deleted, with owner, name, id and scope.
- Proposals filed, accepted and rejected, with the actor and the target.
- Auto-checks queued, claimed and ended, credentials handed to the fetcher, and stored access
  credentials created, changed, tested and deleted.
- Pull probe results of own images, and the cleanup of expired sessions, old tokens and old seen
  marks.
- Request errors with method and path.

No line contains a secret, a token, a session id or a credential. Text from users or identity
providers is quoted, or cut to 200 characters with control characters removed, so it cannot forge
log lines.
The worker logs with the prefixes `[sieb-checker]` and `[sieb-fetcher]`.

## Backup and restore

Everything sieb knows lives in one SQLite file, `/data/sieb.db`: decisions and their history,
proposals, checks, users' tokens and sessions, and sealed access credentials. Findings come back
with the next sync, decisions do not.

The database runs in WAL mode, so copying the file of a running sieb can miss recent writes. Take
a consistent copy with `VACUUM INTO`, stream it out and remove it from the volume:

```sh
kubectl -n sieb exec deploy/sieb -- node -e "
  const { DatabaseSync } = require('node:sqlite')
  const db = new DatabaseSync('/data/sieb.db')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec(\"VACUUM INTO '/data/sieb-backup.db'\")
"
kubectl -n sieb exec deploy/sieb -- cat /data/sieb-backup.db > sieb-backup.db
kubectl -n sieb exec deploy/sieb -- rm /data/sieb-backup.db
```

`VACUUM INTO` refuses to overwrite a file, so remove a copy left over from an interrupted run
first.

Protect the backup like a credential store. Keep it apart from `SIEB_CREDENTIALS_KEY`: the
database alone does not reveal the stored credentials, the database together with the key does.

To restore, stop sieb, replace the file from a helper pod on the same volume, and start sieb
again:

1. Scale sieb down and wait until its pod is gone.
2. Start the helper pod below, which mounts the volume and sleeps, and wait until it is ready.
3. Copy the backup in and replace the database. The old file and its WAL stay next to it as
   `sieb.db.old` and `sieb.db.old-wal`.
4. Delete the helper pod and scale sieb back to one replica.

The helper pod runs the sieb image as the same user (uid 1000), so the restored file has the
owner sieb expects. Save it as `sieb-restore.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sieb-restore
  namespace: sieb
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: restore
      image: ghcr.io/bernhardkelm/sieb:<version>
      command: [sleep, "3600"]
      securityContext:
        allowPrivilegeEscalation: false
        capabilities:
          drop: [ALL]
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: sieb-data
```

The commands for the four steps:

```sh
kubectl -n sieb scale deployment/sieb --replicas=0
kubectl -n sieb wait --for=delete pod -l app.kubernetes.io/name=sieb --timeout=120s
kubectl apply -f sieb-restore.yaml
kubectl -n sieb wait --for=condition=Ready pod/sieb-restore --timeout=120s
kubectl -n sieb exec -i sieb-restore -- sh -c 'cat > /data/sieb.db.new' < sieb-backup.db
kubectl -n sieb exec sieb-restore -- sh -c 'cd /data && mv sieb.db sieb.db.old && if [ -e sieb.db-wal ]; then mv sieb.db-wal sieb.db.old-wal; fi && rm -f sieb.db-shm && mv sieb.db.new sieb.db'
kubectl -n sieb delete pod sieb-restore
kubectl -n sieb scale deployment/sieb --replicas=1
```

Restore with the release that wrote the backup or a newer one. Remove `sieb.db.old` and
`sieb.db.old-wal` from the volume once sieb runs as expected.

## Upgrades

1. Read the release notes and take a backup.
2. Change the image tag to the new `<version>` and apply. With `Recreate`, the old pod stops
   before the new one starts.
3. Watch the log for `[sieb] listening on`. Pending database migrations run at start, each in its
   own transaction, so a failed step leaves the previous version intact.

The short downtime does not wake anyone: the silencing rules hold the last known set for up to six
hours, see [Timing](prometheus-rules.md#timing). An Auto-check running during the restart may
fail; retry it from the Checks page.

Run sieb and the Auto-check worker at the same release, and upgrade both together.

There is no downgrade path. An older release refuses a database that a newer one migrated, with
`database schema version N is newer than this code (M), update sieb first`. To roll back, restore
the backup taken before the upgrade and run the old release.

## Secrets and rotation

After changing a Secret, restart the pods that read it: `kubectl -n sieb rollout restart
deployment/sieb` for sieb, the same for `deployment/sieb-checker`.

### OIDC client secret

Create the new secret at the identity provider, update the `sieb-oidc` Secret and restart sieb.
Sessions live in the database and survive the restart; a sign-in in progress starts over. The
Claude connector's client has no secret in sieb, sieb only verifies its tokens.

### Worker secret

`SIEB_WORKER_SECRET` must be the same in sieb and in the checker container. With the manifests of
[Set it up](auto-check.md#set-it-up), both read it from the key `worker-secret` of the
`sieb-checker` Secret. Generate a new one with `openssl rand -hex 32`, update that key, then
restart sieb and the worker. Between the two restarts the worker is refused and shows offline.
Rotate while no check runs, or retry the check that fails.

### Fetcher and local secrets

`SIEB_FETCHER_SECRET` lives in sieb and in the fetcher container only, both read from the key
`fetcher-secret` of the `sieb-fetcher` Secret. Rotate it like the worker secret. The local secret
between the two containers never leaves the worker pod: update `local-secret` in both
`sieb-checker` and `sieb-fetcher`, then restart the worker.

### Credentials key

sieb has no re-encryption. A new `SIEB_CREDENTIALS_KEY` makes every stored credential unreadable:
the Access page marks them, they cover nothing, and each secret has to be entered again, or the
credential deleted and added again. Removing the key turns private access off and hides the stored
credentials until the same key is back. Rotate the key only when you have to, and keep a copy of
the current key in a safe place apart from the database backups.

### Claude credential

The worker reads `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`; sieb never stores either.
Update the worker's Secret and restart the worker. A subscription token from `claude setup-token`
is valid for one year, so note when it expires. See [Set it up](auto-check.md#set-it-up).

### Personal tokens

Users manage their own tokens in the token dialog. Tokens expire after 30 days, 90 days or one
year, and each user holds at most 20 live ones. sieb deletes revoked and expired tokens 90 days
later. Each Auto-check runs with a token of its own that expires ten minutes after the check's
time limit.

## Offboarding a user

`/mcp` never asks the identity provider, so removing someone there does not stop their personal
tokens by itself. Decisions and proposals keep the username in their history.

In oidc mode, remove the user from the group in `SIEB_OIDC_REQUIRED_GROUP`. New logins stop at
once. The next refused login also deletes the user's sessions, fails their open Auto-checks and
revokes their live tokens, and logs it. Until the user tries, a session lasts until it expires.

In header mode, the proxy stops access to the UI, and the tokens stay valid.

To end access at once in either mode, revoke every live token of the user:

```sh
kubectl -n sieb exec deploy/sieb -- node -e "
  const { DatabaseSync } = require('node:sqlite')
  const db = new DatabaseSync('/data/sieb.db')
  db.exec('PRAGMA busy_timeout = 5000')
  console.log(db.prepare(\"UPDATE api_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), revoked_by = 'admin' WHERE owner = ? AND revoked_at IS NULL\").run(process.argv[1]))
" alice
```

In oidc mode, also delete the user's sessions:

```sh
kubectl -n sieb exec deploy/sieb -- node -e "
  const { DatabaseSync } = require('node:sqlite')
  const db = new DatabaseSync('/data/sieb.db')
  db.exec('PRAGMA busy_timeout = 5000')
  console.log(db.prepare('DELETE FROM sessions WHERE username = ?').run(process.argv[1]))
" alice
```

Access through the Claude connector ends with the account or the group membership at the identity
provider, which issues no new access tokens and refuses the refresh. An access token already
issued stays valid until it expires, which is why its lifetime should be short.

## KEV catalog health

With the default `SIEB_KEV_SOURCE=cisa`, sieb keeps the CISA catalog in its database:

- At start it fetches when no catalog is stored or the stored one is older than 24 hours. A
  restart therefore counts as a retry.
- It then checks every 15 minutes and fetches again once the catalog is 24 hours old. While
  fetches fail, it tries at most once an hour.
- A fetch times out after 60 seconds and refuses bodies over 16 MiB. A malformed feed, an empty
  list or one with fewer than half of the stored entries is refused too.
- A failure only records the error, and the last good catalog stays in use. Fetches never block
  the start or a sync.
- A newly stored catalog triggers a sync, so new listings show up at once. A CVE the feed no longer
  lists stops being KEV listed with that sync.

The catalog counts as stale without a successful fetch or when the last one is older than 48
hours. The sync status dot then turns amber, and its tooltip shows the last error. The log shows
`[sieb] KEV catalog <version> stored` on success and `[sieb] KEV catalog fetch failed` on failure.
`GET /api/sync` answers the same health as `kevFeed`. Fixes for missing egress are in
[KEV source](deployment.md#kev-source).

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| The pod exits at start, the last log line names a variable | A start-up rule failed | Fix that variable, see [Rules sieb enforces at start](reference/configuration.md#rules-sieb-enforces-at-start) |
| `database schema version N is newer than this code` | An older release on a migrated database | Run the newer release, or restore the backup taken before the upgrade |
| Sync fails: `sieb:trivy_finding:info is empty while reports list N vulnerabilities` | The findings rule is missing, not loaded or not yet evaluated | Check the rule and its `release` label, see [Findings query](prometheus-rules.md#findings-query) |
| Sync fails with `failed with 403` for `kubernetes.default.svc` | The ClusterRole or its binding is missing | Apply the RBAC objects of the manifests |
| Sync fails with a certificate error for `kubernetes.default.svc` | `NODE_EXTRA_CA_CERTS` is not set | Point it at the ServiceAccount's `ca.crt` |
| Sync fails: `sieb:kev:listed is empty, the KEV feed is broken` | `SIEB_KEV_SOURCE=prometheus` without a working KEV rule | Fix the rule, see [KEV query](prometheus-rules.md#kev-query) |
| The sync status dot is amber | The KEV catalog is stale | See [KEV catalog health](#kev-catalog-health) |
| Requests answer 403 `forbidden_host` | The `Host` is not in `SIEB_ALLOWED_HOSTS` | Add the public hostname |
| Requests answer 400 `invalid_path` | The path has a dot segment such as `%2e%2e` | Use the plain path; sieb refuses these on purpose |
| Sign-in fails, the log shows `login failed: <reason>` | The provider client or its claims do not match | Check the [Identity provider checklist](deployment.md#identity-provider-checklist) |
| Prometheus gets 404 from sieb | It scrapes the main port while `SIEB_METRICS_PORT` is set | Scrape the metrics port |
| Alerts keep firing after a decision | The alert reads the raw Trivy metric, or the scrape job is not `sieb` | Point it at `sieb:trivy_finding_open:info` and check `up{job="sieb"}` |
| Claude can read but not file proposals | The connector was authorized without `sieb:propose` | Disconnect and connect it again, see [Connect](working-with-claude.md#connect) |
| `sieb_check_worker_online` is 0 | The worker cannot reach the worker port, or its secret differs | Check `SIEB_WORKER_URL`, both NetworkPolicies and the secret, then the worker log |
| Queuing skips a finding "with an image sieb could not probe yet" | An own image whose pull probe got no answer, and no credential covers it | Allow egress to its registry or store a registry credential |
| Private image checks fail: "the image needs a registry credential, which only the fetcher container uses" | The worker runs in single-container mode | Deploy the two-container layout, see [Private access](auto-check.md#private-access) |
| The checker or fetcher refuses a secret that "belongs to" the other container | Both containers share one Secret through `envFrom` | Give each container its own Secret |

Failure reasons of single checks are in [Troubleshooting](auto-check.md#troubleshooting).

## See also

- [Deployment](deployment.md): the manifests, the NetworkPolicy and the security checklist
- [Prometheus rules](prometheus-rules.md): the silencing rules and the alerts on sieb and
  Auto-check
- [Configuration](reference/configuration.md): every variable and the start-up rules
- [Auto-check](auto-check.md#troubleshooting): failure reasons of single checks
