# HTTP API

JSON under `/api`. The acting user comes from the header named by `SIEB_USER_HEADER` (default
`X-authentik-username`), outside production `SIEB_DEV_USER` stands in; without either, reads work
and writes answer 401. Invalid input answers 400
`{ "error": "validation", "errors": [{ "field", "code" }] }`, unknown ids 404, conflicts 409
`{ "error": "conflict" | "revoked", "decisionId" }`.

## Request rules

Checked before identity:

- Every request needs a `Host` that is a loopback name (`localhost`, `127.0.0.1`, `[::1]`, any
  port, which also covers the Vite proxy) or an entry of `SIEB_ALLOWED_HOSTS`, else 403
  `{ "error": "forbidden_host" }` (DNS rebinding). `/metrics` and `/api/health` are exempt: both
  are read-only, and Prometheus and the kubelet reach them by pod IP.
- Every `/api` write (not GET, HEAD, OPTIONS) needs `Content-Type: application/json`, else 415
  `{ "error": "unsupported_media_type" }`, also for writes without a body such as `POST /api/sync`.
  A present `Sec-Fetch-Site` other than `same-origin` or `none`, or a present `Origin` whose host
  differs from `Host`, answers 403 `{ "error": "cross_site_request" }`.
- `/api` bodies are limited to 64 KiB, else 413 `{ "error": "payload_too_large" }`.
- `reason` and the revoke `comment` are at most 2000 characters (`too_long`), a bulk takes at most
  200 `imageRefs` (`too_many`).
- `expiresAt` is an ISO 8601 date-time with `Z` or an offset (`2026-09-01T21:59:59.000Z`,
  `2026-09-01T23:59:59+02:00`), or a date `YYYY-MM-DD` meaning the end of that day in UTC.
  Date-times without an offset are `invalid`, past ones `in_past`, ones more than 3 years ahead
  `too_far`.
- `justification` is optional and only allowed with status `not_affected`, see
  [Justification](#justification): an unknown value is `invalid`, one next to another status
  `not_allowed`, `null` or omitted means none.

## Routes

| Route | Purpose |
| --- | --- |
| `GET /api/health` | `{ status, source }`, no Host check |
| `GET /api/me` | `{ username }` of the acting user |
| `GET /api/findings` | Findings in inbox order; `view=inbox\|all`, `includeResolved`, `q`, `severity`, `exposure`, `owner` (comma lists, `owner` takes free-form owner labels), `newSince` |
| `GET /api/findings/:id` | Finding detail: instances, decisions, history and `kev`, the CISA catalog entry, see [KEV source](#kev-source) |
| `GET /api/images`, `GET /api/cves` | Open findings aggregated per image or per CVE, `includeResolved=true` adds resolved ones |
| `GET /api/decisions` | Decisions with their state, `state=active\|expiring\|expired\|revoked\|reopened\|fix_planned` |
| `POST /api/decisions` | Create an image-scoped or all-scope decision, `{ vulnId, scope, imageRef?, status, justification?, reason, expiresAt? }` |
| `PATCH /api/decisions/:id` | Change status, justification, reason or expiry; `reconfirm: true` re-confirms at the current findings |
| `POST /api/decisions/:id/revoke` | Revoke, optional `{ "comment" }` |
| `POST /api/decisions/bulk` | `{ vulnId, imageRefs: [...] \| "all-open", status, justification?, reason, expiresAt? }`, images with a decision are skipped with reason `decided`, `expired` or `reopened`, unknown ones with `unknown_finding` |
| `GET /api/sync`, `POST /api/sync` | `{ run, lastFinished, running, kevFeed }`: latest run and the health of the CISA catalog; run a sync and answer the finished run |
| `GET /api/stats` | `{ current, series }`: live overview counts and their history, `range=7d\|30d\|90d` (default `30d`) |
| `GET /api/labels` | `{ exposure, owners, kev }`: which optional labels the open findings carry and the KEV source, see [Labels](#labels) |

## Justification

A `not_affected` decision may carry an OpenVEX justification: `component_not_present`,
`vulnerable_code_not_present`, `vulnerable_code_not_in_execute_path`,
`vulnerable_code_cannot_be_controlled_by_adversary` or `inline_mitigations_already_exist`. Every
decision in the list, detail and write answers has `justification`, the value or `null`. It is
accepted by create, patch and bulk; on a bulk every created decision gets it. A `PATCH` that sets
a justification answers 400 `not_allowed` unless the decision is `not_affected` after the patch,
`justification: null` clears it, and a `PATCH` that changes the status away from `not_affected`
clears it without being asked. History records it like any other field: the `created` event holds
it with the decision, an `updated` event a change as `justification: [before, after]`. The
justification is informational: any effective `not_affected` decision silences and leaves the risk
counts, with or without one, and `/metrics` is unchanged.

Schema step 6 adds the nullable column `decisions.justification` with checks for the known values
and status `not_affected`. Existing decisions keep `null`, no row is rewritten; the step runs on
the next start like every migration.

## Labels

A finding's `exposure` is `public`, `gated`, `internal` or `null` (no or an unrecognised
`exposure` label in the findings query, shown as unknown). `owner` is a free-form string or `null` (no or an invalid
`owner` label); only `self` has a meaning, own images first. Inbox order and the `maxExposure` of
`GET /api/images` and `GET /api/cves` rank exposure public > gated > unknown > internal; owners
sort `self` first, the others alphabetically, `null` last. An `exposure` or `owner` filter never
matches `null`. `owner` filter entries are trimmed and must be at most 64 characters, an entry
longer than that answers 400 `invalid`; owners never contain commas or control characters, so
the comma list stays unambiguous. See [prometheus-rules.md](prometheus-rules.md) for the labels.

`GET /api/labels` answers `{ "exposure": boolean, "owners": string[], "kev": "cisa" | "prometheus" | "none" }`:
`exposure` is true when at least one open finding has an exposure, `owners` lists their distinct
owners, `self` first, then alphabetical, empty when none has an owner, and `kev` is the configured
`SIEB_KEV_SOURCE`. The client hides the exposure column, filter, chip and "Public" stat while
`exposure` is false, and the owner column and filter while `owners` is empty; the owner filter
offers `owners`. For `kev: "none"` it hides every KEV element: the KEV column, sort and chip in the
lists and the panel, the KEV stat, the KEV catalog link and the KEV wording of decisions. Until the
first answer it hides exposure and owner and shows KEV. It refetches after every sync and decision.

## Aggregates

`GET /api/images` answers one entry per image. Its risk counts `openCount`, `openBySeverity`,
`maxSeverity`, `kevCount` and `fixableCount` leave out open findings governed by an active
`not_affected` decision; `includingNotAffected` holds the same five counts over every open
finding. `notAffectedCount` and `acceptedCount` count the open findings governed by an active
decision of that status, accepted findings stay in the risk counts. An image whose open findings
are all not affected has `openCount` 0. The default order uses the risk counts.

`GET /api/cves` answers one entry per CVE, `decisionStates` counts its open findings by the state
of their governing decision. The client treats a CVE as fully decided when every open finding has
the state `active` or `fix_planned`, and hides it in the by-CVE view until "Show decided" is on.

## Stats

`GET /api/stats` counts open findings (vuln_id x image_ref): `open`, `inbox`, `kev`, `public`
(max exposure public, 0 without exposure labels), `bySeverity` (`critical`, `high`, `medium`, `low`, `unknown`),
`notAffected` and `accepted` (governed by an active decision of that status, together the findings
whose alerts are silenced), `images` (distinct image_refs), and decisions by state:
`activeDecisions`, `fixPlanned`, `reopened`. `current` is computed on every request.
`series` holds `{ at, stats }` snapshots, written by every successful sync in its transaction;
`notAffected` and `accepted` are `null` in snapshots taken before they were counted apart, which
held only their sum as `suppressed`, so a trend of those two starts with the first newer snapshot:
the range is split into 60 equal buckets and the latest snapshot of each is kept, oldest first.
Snapshots older than 180 days are deleted during the sync. In mock mode, when no snapshot is older
than a day, the first sync is followed by 30 days of deterministic synthetic history (one point per
2 hours, converging to the current counts); the live sources never get synthetic history.

## Sync

Findings come from the findings query joined with the VulnerabilityReports on namespace, kind,
name, image and vuln id (see [prometheus-rules.md](prometheus-rules.md)). A sync that fails, whose
findings query is empty while reports list vulnerabilities, or, with `SIEB_KEV_SOURCE=prometheus`,
whose KEV query is empty, resolves nothing. A sync commits the snapshot, the decision transitions
and its own success in one transaction.

## KEV source

`SIEB_KEV_SOURCE` decides where a finding's `kev` flag comes from:

- `cisa` (default): sieb downloads the CISA KEV JSON feed (`SIEB_KEV_URL`, an http or https URL,
  default the CISA feed) and stores it in SQLite. It fetches on start when no catalog is stored or
  the stored one is older than 24h, then checks every 15 minutes and fetches again once the catalog
  is 24h old, at most once an hour while fetches fail. A fetch times out after 60s and refuses
  bodies over 16 MiB. Entries without a valid `cveID` or `dateAdded` are skipped; a network error, a
  non-2xx answer, invalid JSON, a feed without a `vulnerabilities` list, a `count` that disagrees
  with the list, no valid entry, or fewer than half of the stored entries only record the error and
  keep the stored catalog. Fetches never block start or a sync: every sync reads the stored catalog,
  a CVE the feed no longer lists stops being KEV with the next sync, and outside mock mode a newly
  stored catalog triggers a sync. Before the first successful fetch, syncs keep the stored `kev`
  flags and add new findings as not listed. `GET /api/findings/:id` answers the catalog entry of a
  KEV listed finding as `kev`: `{ vendorProject, product, vulnerabilityName, dateAdded,
  shortDescription, requiredAction, dueDate, knownRansomware, notes }`, dates as `YYYY-MM-DD`,
  `knownRansomware` true for `Known`, false for `Unknown`, null otherwise; text fields may be null.
  `GET /api/sync` answers the catalog health as `kevFeed`: `{ lastAttemptAt, lastSuccessAt,
  lastError, catalogVersion, entryCount, stale }`, where `lastError` belongs to the latest attempt
  and `stale` is true without a successful fetch or when the last one is older than 48h. The client
  marks a stale catalog on the sync status. Failed fetches are logged.
- `prometheus`: the KEV query `SIEB_KEV_QUERY` (see
  [prometheus-rules.md](prometheus-rules.md#kev-query)), read with every sync. Only the flag is
  known, `kev` of the finding detail and `kevFeed` are null.
- `none`: no finding is KEV listed, the inbox ranks by exposure, severity and score only and the
  client hides every KEV element. `kev` and `kevFeed` are null.

A decision records the KEV listing in its baseline, so switching from `none` to a KEV source
re-opens the decisions whose CVEs are KEV listed.

Mock mode never touches the network. For `cisa` and `prometheus` every mock sync takes the KEV
listing of its fixture state (`fixtures/*/kevCatalog.json`, in the shape of the CISA feed), so the
second state's new listing re-opens decisions as a live feed would. For `cisa` the fixture catalog
of both states is also stored on every start in place of the feed, so the finding panel shows its
details and `kevFeed` its health. `none` works as in live mode.

## Re-opening

A decision records a baseline (severity and KEV listing) for every image it governs: an
image-scoped decision for its image, an all-scope decision for every image without its own
decision. An image the CVE newly appears in, or one that falls back to the all-scope decision when
its own decision is revoked, gets its baseline at first sight. A decision re-opens as soon as any
governed open finding ranks above its own baseline or is KEV listed while its baseline was not;
the whole decision re-opens then. The sync that sees this latches it (`reopenedAt`,
`reopenTrigger`, one `reopened` event), so the decision stays re-opened when the severity or KEV
listing falls back. Only `PATCH` with `reconfirm: true` clears the latch and records new
baselines; edits of reason, status or expiry without it keep the decision re-opened. Expired and
re-opened events are written once per transition.

## Metrics

`GET /metrics` (Prometheus text format, no authentication, no Host check) exposes:

- `sieb_suppressed{vuln_id, image_ref} 1` for every open finding whose governing decision silences
  alerts. All-scope decisions expand to one series per image the CVE is currently found in, so an
  image with its own expired or re-opened decision stays unsilenced; new images are covered from
  the next sync on.
- `sieb_last_sync_timestamp_seconds`, `sieb_last_sync_success` (0/1), `sieb_findings_open`, and
  `sieb_decisions{state}` per decision state.
