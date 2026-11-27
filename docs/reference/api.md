# HTTP API reference

The exact contract of sieb's JSON API under `/api`, the login routes under `/auth`, `/metrics` and the
worker listener. It is for people who write a client, a script or a monitoring rule against sieb.
For the user-facing behaviour behind a route, follow the links to the guides.

On this page:

- [Conventions](#conventions): identity, errors, caching
- [Request rules](#request-rules): the checks every request passes
- [Route index](#route-index)
- [Findings](#findings), [Images and CVEs](#images-and-cves), [Decisions](#decisions)
- [Sync and stats](#sync-and-stats), [Labels](#labels), [Inbox](#inbox), [Proposals](#proposals)
- [Image access](#image-access), [Tokens and Claude connection](#tokens-and-claude-connection)
- [Checks](#checks), [Access credentials](#access-credentials)
- [Login routes](#login-routes), [Metrics](#metrics), [Worker listener](#worker-listener)
- [MCP endpoint and OAuth metadata](#mcp-endpoint-and-oauth-metadata)

## Conventions

### Identity

The acting user comes from the authentication mode (`SIEB_AUTH`):

| Mode | Where the user comes from | Without a user |
| --- | --- | --- |
| `header` | The header named by `SIEB_USER_HEADER` (default `X-authentik-username`). Outside production `SIEB_DEV_USER` (default `dev`) stands in when the header is missing | Writes answer 401, most reads work |
| `oidc` | The session of sieb's own login. The user header and `SIEB_DEV_USER` are ignored | Every `/api` route except `/api/health` answers 401 |

An `Authorization` header is ignored under `/api`. Bearer tokens authenticate only `/mcp`.

In `header` mode these routes need a user even though they only read:

- `GET /api/inbox`
- every `/api/tokens` route
- every `/api/credentials` route

They answer 401 `{ "error": "unauthorized" }` without one. Every write needs a user too.

These reads work without a user and add per-user data when one is present:

- `GET /api/findings` adds `seen` and resolves the `pending` filter against the user's Inbox.
- `GET /api/mcp-info` adds `claude`, `null` without a user.
- `GET /api/me` answers `username` as `null`.

### Errors

| Status | Body | Meaning |
| --- | --- | --- |
| 400 | `{ "error": "validation", "errors": [{ "field", "code" }] }` | Invalid input. `field` is `null` for the whole body, code `invalid_body` for a body that is not a JSON object |
| 401 | `{ "error": "unauthorized" }` | No acting user |
| 404 | `{ "error": "not_found" }` | Unknown id or path |
| 409 | `{ "error": "<code>" }` plus context fields | Conflict with the stored state, codes are listed per route |
| 500 | `{ "error": "internal_error" }` | Unexpected failure, logged without a request body |

A decision conflict answers 409 `{ "error": "conflict" | "revoked", "decisionId" }`.

### Caching

Routes that depend on the user or carry secrets answer `Cache-Control: no-store`: inbox, tokens,
credentials, checks, `mcp-info` and the worker routes. Every response carries
`X-Content-Type-Options: nosniff` and `Content-Security-Policy: frame-ancestors 'none'`.

## Request rules

Checked in this order, before the route runs:

1. A request target with a dot segment (`.` or `..`, literal or percent-encoded in any case, also
   with backslashes) answers 400 `{ "error": "invalid_path" }`. No path can be normalised into
   another route behind a path-based Ingress rule.
2. `Host` must be a loopback name (`localhost`, `127.0.0.1`, `[::1]`, any port) or an entry of
   `SIEB_ALLOWED_HOSTS`, else 403 `{ "error": "forbidden_host" }`. `/metrics` and `/api/health`
   are exempt, Prometheus and the kubelet reach them by pod IP.
3. In `oidc` mode the session check runs here, see [Login routes](#login-routes).
4. An `/api` write (not `GET`, `HEAD` or `OPTIONS`) needs `Content-Type: application/json`, else 415
   `{ "error": "unsupported_media_type" }`. This holds for writes without a body too, such as
   `POST /api/sync`.
5. A present `Sec-Fetch-Site` other than `same-origin` or `none`, or a present `Origin` whose host
   differs from `Host`, answers 403 `{ "error": "cross_site_request" }`.
6. `/api` bodies are limited to 64 KiB, else 413 `{ "error": "payload_too_large" }`.
7. In `header` mode a write without a user answers 401.

### Shared field rules

| Field | Rule |
| --- | --- |
| `reason`, revoke `comment` | At most 2000 characters (`too_long`) |
| `imageRefs` of a bulk decision | At most 200 entries (`too_many`) |
| `expiresAt` | ISO 8601 date-time with `Z` or an offset (`2026-09-01T21:59:59.000Z`, `2026-09-01T23:59:59+02:00`), or a date `YYYY-MM-DD` meaning the end of that day in UTC. Without an offset `invalid`, in the past `in_past`, more than 3 years ahead `too_far` |
| `justification` | Optional, only with status `not_affected`, see [Decisions](#decisions) |
| `upstreamPending`, `waitingFor` | Optional, only with status `fix_planned`, see [Decisions](#decisions) |

## Route index

| Route | Section |
| --- | --- |
| `GET /api/health`, `GET /api/me` | [Health and session](#health-and-session) |
| `GET /api/findings`, `POST /api/findings/seen`, `GET /api/findings/:id` | [Findings](#findings) |
| `GET /api/images`, `GET /api/cves` | [Images and CVEs](#images-and-cves) |
| `GET /api/decisions`, `POST /api/decisions`, `PATCH /api/decisions/:id`, `POST /api/decisions/:id/revoke`, `POST /api/decisions/bulk` | [Decisions](#decisions) |
| `GET /api/sync`, `POST /api/sync`, `GET /api/stats` | [Sync and stats](#sync-and-stats) |
| `GET /api/labels` | [Labels](#labels) |
| `GET /api/inbox`, `POST /api/inbox/seen` | [Inbox](#inbox) |
| `GET /api/proposals`, `GET /api/proposals/:id`, accept, reject, `bulk-accept`, `bulk-reject` | [Proposals](#proposals) |
| `GET /api/tokens`, `POST /api/tokens`, revoke, delete, cleanup, `GET /api/mcp-info` | [Tokens and Claude connection](#tokens-and-claude-connection) |
| `GET /api/checks`, `POST /api/checks`, `DELETE /api/checks/:id` | [Checks](#checks) |
| `GET /api/credentials`, `POST /api/credentials`, `PATCH`, `DELETE`, test routes | [Access credentials](#access-credentials) |
| `GET /auth/signin`, `GET /auth/login`, `GET /auth/callback`, `POST /auth/logout` | [Login routes](#login-routes) |
| `GET /metrics` | [Metrics](#metrics) |
| `POST /worker/claim`, heartbeat, result, `access`, `source` | [Worker listener](#worker-listener) |
| `/mcp`, `/.well-known/oauth-protected-resource` | [MCP endpoint and OAuth metadata](#mcp-endpoint-and-oauth-metadata) |

## Health and session

| Route | Answer |
| --- | --- |
| `GET /api/health` | `{ status, source }`, no `Host` check, no session in `oidc` mode |
| `GET /api/me` | `{ username, authMode, version, sourceCodeUrl }` |

`authMode` is `header` or `oidc`, so a client knows whether a 401 means signing in again.
`sourceCodeUrl` is `SIEB_SOURCE_URL`, otherwise the upstream tree of the running version tag.

## Findings

| Route | Purpose |
| --- | --- |
| `GET /api/findings` | Findings in triage order, filtered by the parameters below |
| `POST /api/findings/seen` | Marks findings seen for the acting user, needs a user |
| `GET /api/findings/:id` | Detail for the side panel |

### Finding filters

`GET /api/findings` takes these optional query parameters. The MCP tool `search_findings` offers the
same filters, see [MCP tools](mcp.md#tools).

| Parameter | Value |
| --- | --- |
| `view` | `inbox` or `all` (default). `inbox` keeps findings without an active or `fix_planned` decision |
| `includeResolved` | `true` or `1`, only with `view=all` |
| `q` | Free text search |
| `severity` | Comma list of `Critical`, `High`, `Medium`, `Low`, `Unknown` |
| `exposure` | Comma list of `public`, `gated`, `internal`, `unknown`. `unknown` matches findings without a label |
| `owner` | Comma list of owner labels, each at most 64 characters, never matches findings without an owner |
| `newSince` | Date or timestamp, keeps findings first seen at or after it |
| `kev` | `true` or `1` keeps KEV listed findings only |
| `vulnIds`, `packages`, `images`, `namespaces`, `workloads` | Comma lists of name patterns, see below |
| `minScore` | 0 to 10, keeps findings with at least that score. Findings without a score never match |
| `decisionState` | Comma list of `undecided`, `active`, `not_affected`, `accepted`, `fix_planned`, `expired`, `reopened`. `active` covers active `not_affected` and `accepted` |
| `kevAddedSince` | Date or timestamp, keeps findings whose CISA `date_added` is on or after that day (UTC). Ignored unless `SIEB_KEV_SOURCE=cisa` |
| `fixable` | `true` or `1` keeps findings with a known fixed version in a current instance, `false` or `0` those without |
| `upstreamPending` | `true` or `1` keeps findings whose governing decision waits for upstream, `false` or `0` the others |
| `pending` | Comma list of `proposed`, `reopened`, `kev`, `checking`, `untouched` |

A name pattern matches exactly, or by prefix when it ends with `*`, both case-insensitive, at most
256 characters. A tag or digest in an `images` pattern is ignored. A `workloads` pattern matches
`namespace/kind/name`, `namespace/name` or the resource name. Several patterns of one parameter
match any of them.

`pending` is matched against the [Inbox](#inbox) of the acting user, without the items that user
marked as seen (an anonymous read has none marked):

- `proposed`: an open proposal targets the finding's image, several images including it, or every image.
- `reopened`: its governing decision is re-opened.
- `kev`: its new KEV listing is in the Inbox.
- `checking`: a queued or running Auto-check, ignored while Auto-check is off.
- `untouched`: none of the above. Resolved findings count as untouched, expiring decisions do not count.

An invalid value answers 400 `invalid` for its field. `search_findings` names `q` as `text` and
`newSince` as `firstSeenSince`, takes the lists as JSON arrays and adds `groupBy`, `limit` and
`offset`.

### Finding list answer

An array of findings. Each finding carries:

| Field | Meaning |
| --- | --- |
| `fixable` | Boolean, a current instance has a fixed version |
| `kev` | Boolean, KEV listed |
| `exposure`, `owner` | Labels, `null` when absent, see [Labels](#labels) |
| `decision`, `effective` | Governing decision and its state, `null` when undecided |
| `seen` | `true` when the acting user marked a recent finding seen, else `false` |
| `coveredByProposal` | Id of the newest open proposal listing the finding in `relatedFindings`, else `null` |

A finding counts as new for a user while sieb first saw it within the last 7 days (`firstSeen`)
and the user has not marked it seen. `seen` is looked up only for findings first seen within those
7 days, so older findings and anonymous reads answer `false`. The other routes and the MCP tools
leave the field out. The `newSince` filter is purely time based.

### Seen findings

`POST /api/findings/seen` takes `{ "ids": [...] }`, at most 200 positive integers (`required`,
`invalid`, `too_many` on `ids`, `invalid` on `ids.<index>`), and answers `{ ignored }`. It marks the
findings first seen within the last 7 days. `ignored` lists the valid ids it did not mark, which are
unknown or older findings. Marking again changes nothing.

Marks do not count towards the 5000 Inbox marks per user. Each mark drops the user's finding marks
whose finding left the 7 days, and the 30 day cleanup covers them too.

### Finding detail

`GET /api/findings/:id` answers:

| Field | Meaning |
| --- | --- |
| `finding` | The finding with `coveredByProposal` |
| `instances` | Resolved ones included, open first, each with the fields of [Found in](#found-in) |
| `decisions` | Every decision covering the finding, revoked included, newest first |
| `events` | History of those decisions, oldest first |
| `kev` | CISA catalog entry or `null`, see [KEV details](#kev-details) |
| `imageVisibility`, `ownership` | Facts of the image, see [Image access](#image-access) |
| `checkAccess` | `[ImageCheckAccess]`, how Auto-check reaches the image, see [Image access](#image-access) |

An unknown id answers 404. An own image without a fresh pull probe is probed first, the answer
waits at most 1.5 seconds for it.

### Found in

Every instance carries where Trivy found its package. Every field is optional and `null` or `[]`
when missing, not a plain string, or over its cap.

| Field | Content |
| --- | --- |
| `locations` | `[{ target, pkgPath }]`, distinct, at most 20 |
| `packageType` | Trivy `packageType`, such as `gobinary`, `npm`, `python-pkg`, `debian`, `alpine`. At most 64 characters |
| `packageClass` | Trivy `class`, `os-pkgs` or `lang-pkgs`. At most 64 characters |
| `purl` | `packagePURL`, else `pkgIdentifier.PURL` or `purl`, only with the `pkg:` scheme. At most 512 characters |

`target` is the scanned file or the OS release, `pkgPath` the package file inside the image
(1024 characters at most each). One instance is one package version in one container. When Trivy
lists the package in two binaries of a container, the instance keeps both locations. Type, class
and PURL come from the first entry that has them.

Trivy Operator writes these fields only when `trivy.additionalVulnerabilityReportFields` includes
`Target`, `Class`, `PackageType` and `PackagePath`. The MCP tools `get_finding` and
`check_vulnerability` answer the locations as `foundIn` per image.

### KEV details

`kev` of the finding detail is the CISA catalog entry of a KEV listed finding:

```json
{
  "vendorProject": "Example Vendor",
  "product": "Example Product",
  "vulnerabilityName": "Example Product remote code execution",
  "dateAdded": "2025-01-15",
  "shortDescription": "…",
  "requiredAction": "…",
  "dueDate": "2025-02-05",
  "knownRansomware": true,
  "notes": "…"
}
```

Dates are `YYYY-MM-DD`. `knownRansomware` is `true` for `Known`, `false` for `Unknown`, else `null`.
Text fields may be `null`. With `SIEB_KEV_SOURCE=prometheus` or `none`, `kev` is `null` and
`GET /api/sync` answers `kevFeed` as `null`. How the catalog is fetched is described in
[operations](../operations.md).

## Images and CVEs

`GET /api/images` and `GET /api/cves` aggregate open findings. `includeResolved=true` adds findings
that are resolved.

`GET /api/images` answers one entry per image:

| Field | Meaning |
| --- | --- |
| `openCount`, `openBySeverity`, `maxSeverity`, `kevCount`, `fixableCount` | Risk counts without open findings governed by an active `not_affected` decision |
| `includingNotAffected` | The same five counts over every open finding |
| `notAffectedCount`, `acceptedCount` | Open findings governed by an active decision of that status. Accepted findings stay in the risk counts |
| `maxExposure` | Most exposed label, ranked public, gated, unknown, internal |

An image whose open findings are all not affected has `openCount` 0. The default order uses the
risk counts.

`GET /api/cves` answers one entry per CVE:

| Field | Meaning |
| --- | --- |
| `decisionStates` | Counts of its open findings by the state of their governing decision |
| `allScopeDecision` | The non-revoked all-scope decision of the CVE, else `null` |
| `allScopeEffective` | Its state as in `DecisionView.effective`, a pending re-open included |

## Decisions

| Route | Purpose |
| --- | --- |
| `GET /api/decisions` | Decisions with their state, optional `state=active\|expiring\|expired\|revoked\|reopened\|fix_planned\|upstream_pending` |
| `POST /api/decisions` | Creates an image-scoped or all-scope decision, answers 201 |
| `PATCH /api/decisions/:id` | Changes status, justification, reason, expiry or the upstream fields, or re-confirms |
| `POST /api/decisions/:id/revoke` | Revokes, optional `{ "comment" }` |
| `POST /api/decisions/bulk` | Creates image-scoped decisions of one CVE for many images |

An invalid `state` answers 400 `invalid`. Every answer is a `DecisionView`
`{ decision, effective, openFindings }`: the decision, its state, and the number of open findings it
governs.

### Create and change

`POST /api/decisions` takes:

```json
{
  "vulnId": "CVE-2099-10001",
  "scope": "image",
  "imageRef": "registry.example.com/acme/shop",
  "status": "not_affected",
  "justification": "vulnerable_code_not_in_execute_path",
  "reason": "The affected function is never called.",
  "expiresAt": "2026-09-01",
  "upstreamPending": false,
  "waitingFor": null
}
```

- `scope` is `image` (needs `imageRef`) or `all`.
- `status` is `not_affected`, `accepted` or `fix_planned`.
- An omitted `expiresAt` takes the default of the status. `null` means no expiry.
- Every image or CVE needs an open finding: a vulnerability or image without one answers 400
  `unknown_finding` on `vulnId` (scope `all`) or `imageRef` (scope `image`).

`PATCH /api/decisions/:id` takes any of `status`, `justification`, `reason`, `expiresAt`,
`upstreamPending`, `waitingFor` and `reconfirm`. Fields left out stay as they are. A revoked decision
answers 409 `revoked`, a conflicting one 409 `conflict`, both with `decisionId`.

`POST /api/decisions/:id/revoke` takes an optional `{ "comment" }` (at most 2000 characters).

### Justification

A `not_affected` decision may carry an OpenVEX justification: `component_not_present`,
`vulnerable_code_not_present`, `vulnerable_code_not_in_execute_path`,
`vulnerable_code_cannot_be_controlled_by_adversary` or `inline_mitigations_already_exist`.

- Every decision answer has `justification`, the value or `null`.
- Create, patch and bulk accept it. On a bulk every created decision gets it.
- An unknown value is `invalid`, one next to another status `not_allowed`. `null` or omitted means none.
- A `PATCH` that sets a justification answers 400 `not_allowed` unless the decision is `not_affected`
  after the patch. `justification: null` clears it, and changing the status away from
  `not_affected` clears it without being asked.
- History records it like any field: the `created` event holds it, an `updated` event holds a change
  as `justification: [before, after]`.

The justification is informational. Any effective `not_affected` decision silences alerts and
leaves the risk counts, with or without one, and `/metrics` is unchanged.

### Waiting for upstream

A `fix_planned` decision may wait for an upstream release. Set `upstreamPending: true` together with
`waitingFor` (at most 160 characters naming the release or image awaited) and an `expiresAt`, which
serves as the review date.

| Case | Code |
| --- | --- |
| `upstreamPending` with another status | `upstreamPending` `not_allowed` |
| `upstreamPending` without `waitingFor` | `waitingFor` `required` |
| `upstreamPending` without an expiry | `expiresAt` `required` |
| `waitingFor` without `upstreamPending` | `waitingFor` `not_allowed` |
| `waitingFor` over 160 characters | `waitingFor` `too_long` |
| `upstreamPending` not a boolean, `waitingFor` not a string | `invalid` |

- Every decision answer carries `upstreamPending` (`false` by default) and `waitingFor` (`null` unless waiting).
- A `PATCH` checks the rules against the stored decision after the change. A status leaving
  `fix_planned` clears both fields without being asked.
- `state=upstream_pending` lists the non-revoked decisions waiting for upstream. They also count
  under their own state.
- Suppression, `/metrics`, the stats and the OpenVEX mapping treat them as any `fix_planned` decision.
- Accepting a `fix_planned` proposal whose `fix.availability` is `upstream_pending` carries the
  fields over, see [Proposals](#proposals).

### Re-opening

A decision records a baseline (severity and KEV listing) for every image it governs: an
image-scoped decision for its image, an all-scope decision for every image without its own
decision. An image the CVE newly appears in, or one that falls back to the all-scope decision when
its own decision is revoked, gets its baseline at first sight. Under an all-scope decision this also
writes an `updated` event by `sieb` with the payload `{ coveredImage }`.

A decision re-opens as soon as any governed open finding ranks above its baseline or is KEV listed
while its baseline was not. The whole decision re-opens then.

| State | `effective` | `reopenedAt` |
| --- | --- | --- |
| Pending, no sync has seen it | `reopened` | `null` |
| Latched by a sync (`reopenTrigger`, one `reopened` event) | `reopened` | The sync time |

A latched decision stays re-opened when the severity or KEV listing falls back. Only `PATCH` with
`reconfirm: true` clears the latch and records new baselines at the current findings, which also
settles a pending re-open. Edits of reason, status or expiry without it keep the decision
re-opened. Expired and re-opened events are written once per transition. Concept and behaviour in the
UI: [Expiry and re-opening](../triage.md#expiry-and-re-opening).

### Bulk decisions

`POST /api/decisions/bulk` takes:

```json
{
  "vulnId": "CVE-2099-10001",
  "imageRefs": ["registry.example.com/acme/shop", "registry.example.com/acme/api"],
  "status": "accepted",
  "reason": "Tracked in the platform backlog.",
  "expiresAt": "2026-09-01"
}
```

`imageRefs` is a list of at most 200 images or the string `"all-open"`. It answers
`{ created: DecisionView[], skipped: [{ imageRef, reason, decisionId }] }`. An image with an existing
non-revoked decision is skipped with the reason `decided`, `expired` or `reopened`, an image without
a finding with `unknown_finding` (`decisionId` is `null` then). The whole bulk is one transaction.

## Sync and stats

| Route | Purpose |
| --- | --- |
| `GET /api/sync` | `{ run, lastFinished, running, kevFeed }` |
| `POST /api/sync` | Runs a sync, or joins the running one, and answers the finished run, a failed one included |
| `GET /api/stats` | `{ current, series }` |

`run` is the latest run (possibly still running), `lastFinished` the latest finished one.
`kevFeed` describes the CISA catalog and is `null` unless `SIEB_KEV_SOURCE=cisa`:

```json
{
  "lastAttemptAt": "2026-06-01T10:00:00.000Z",
  "lastSuccessAt": "2026-06-01T10:00:00.000Z",
  "lastError": null,
  "catalogVersion": "2026.06.01",
  "entryCount": 1200,
  "stale": false
}
```

`lastError` belongs to the latest attempt. `stale` is `true` without a successful fetch or when the
last one is older than 48 hours.

Findings come from the findings query joined with the VulnerabilityReports on namespace, kind, name,
image and vulnerability id, see [Prometheus rules](../prometheus-rules.md). A sync resolves nothing when
it fails, when the findings query is empty while reports list vulnerabilities, or, with
`SIEB_KEV_SOURCE=prometheus`, when the KEV query is empty. A sync commits the snapshot, the decision
transitions and its own success in one transaction.

### Stats

`GET /api/stats` takes `range=24h|7d|30d|90d` (default `30d`, else 400 `invalid`).

`current` is computed on every request and counts open findings (CVE and image pairs):

| Field | Meaning |
| --- | --- |
| `open` | Open findings |
| `inbox` | Open findings without an active or `fix_planned` decision |
| `kev` | KEV listed |
| `public` | Maximum exposure `public`, 0 without exposure labels |
| `bySeverity` | `critical`, `high`, `medium`, `low`, `unknown` |
| `notAffected`, `accepted` | Governed by an active decision of that status, together the findings whose alerts are silenced |
| `images` | Distinct images with an open finding |
| `activeDecisions`, `fixPlanned`, `reopened` | Decisions by state |

`series` holds `{ at, stats }` snapshots written by every successful sync. `notAffected` and
`accepted` inside a snapshot may be `null`. The range is split into 60 equal buckets and the latest
snapshot of each is kept, oldest first. Snapshots older than 180 days are deleted during a sync.

## Labels

A finding's `exposure` is `public`, `gated`, `internal` or `null` (no label or an unrecognised
value, shown as unknown). `owner` is a free-form string or `null`. Only `self` has a meaning: own
images first. The labels come from the findings query, see [Prometheus rules](../prometheus-rules.md).

| Rule | Behaviour |
| --- | --- |
| Exposure order | `public`, `gated`, unknown, `internal`, also for `maxExposure` of images and CVEs |
| Owner order | `self` first, the others alphabetically, `null` last |
| `owner` filter | Entries trimmed, at most 64 characters (`invalid` otherwise). Never matches `null` |
| `exposure` filter | Takes `unknown` next to the three labels to match `null` |
| Owner values | Never contain commas or control characters, so the comma list stays unambiguous |

`GET /api/labels` answers:

```json
{ "exposure": true, "owners": ["self", "platform"], "kev": "cisa" }
```

`exposure` is `true` when at least one open finding has an exposure label. `owners` lists the distinct
owners of open findings, `self` first, empty when none has one. `kev` is the configured
`SIEB_KEV_SOURCE`. How the client uses it is described in
[Exposure and owner](../triage.md#exposure-and-owner).

## Inbox

The Inbox collects what waits for the acting user. Both routes need a user, since seen marks are per
user (401 `{ "error": "unauthorized" }` without one), and answer `Cache-Control: no-store`.

`GET /api/inbox` answers `{ items, counts }`. `counts` is `{ proposal, reopened, expiring, kev, total }`
over the listed items. Every item carries:

| Field | Meaning |
| --- | --- |
| `key` | Stable identity |
| `kind` | `proposal`, `reopened`, `expiring` or `kev` |
| `at` | The time the item sorts by |
| `vulnId`, `imageRef` | `imageRef` is `null` for a decision on every image or a proposal on several |
| `severity`, `kev` | Highest severity and any KEV listing of the open findings it covers |
| `title` | Advisory title of a covered finding, may be `null` |
| `exposure` | Most exposed of the covered open findings, `null` when unknown or none is covered |
| `owners`, `packages`, `namespaces` | Distinct and sorted over the covered open findings and their open instances |
| `url` | Absolute link into sieb on `SIEB_PUBLIC_URL`, else on the origin of the request |
| `refs` | Ids, per kind below |

| Kind | Key | `at` | In the Inbox while |
| --- | --- | --- | --- |
| `proposal` | `proposal:<id>` | `createdAt` | The proposal is open |
| `reopened` | `reopened:<decisionId>:<reopenedAt>` | `reopenedAt` | The decision is re-opened, until re-confirmed (also within an edit) or revoked |
| `expiring` | `expiring:<decisionId>:<expiresAt>` | `expiresAt` | The decision is active and expires within 14 days, until extended or marked seen |
| `kev` | `kev:<findingId>` | `kevSince` | The open finding became KEV listed within 14 days, also when decided, until marked seen |

Extra fields per kind:

| Kind | Extra fields |
| --- | --- |
| `proposal` | `refs: { proposalId }`, `imageRefs` (`null` for every image), `verdict`, `confidence`, `patchAction` (`fix.action` of a patch verdict, else `null`), `upstreamPending`, `clientKind`, `clientLabel`, `agent`, `imageCount`, `currentDecisionIds`, `outdated` |
| `reopened` | `refs: { decisionId, findingId }`, `decisionStatus`, `reopenReason` |
| `expiring` | `refs: { decisionId, findingId }`, `decisionStatus` |
| `kev` | `refs: { findingId, decisionId }`, `decisionStatus` (governing decision, else `null`) |

`currentDecisionIds` is the governing decision per target, the `expectedDecisionIds` of an accept.
`outdated` is `true` when a governing decision changed since the proposal was filed.

A re-open the current data shows but no sync has latched yet uses `pending` instead of
`<reopenedAt>` and the current time as `at`. Extending an expiring decision gives it a new key, so it
shows again when it comes within 14 days of its new expiry.

Items link as follows: a proposal to `/inbox/proposals/<id>`, the other kinds to
`/triage?finding=<id>` (the covered finding the re-open names, else the most pressing one), and a
decision without open findings to the decisions view. Inside the client, the Inbox markers on rows
and in the finding panel link to `/inbox?item=<key>`, which starts the Inbox cursor on that item.

Order: events first, newest first (proposals, re-opened decisions and new KEV listings interleaved
by `at`), then expiring decisions soonest first, ties by `key`.

`POST /api/inbox/seen` takes `{ "keys": [...] }`, at most 200 keys (`required`, `invalid`, `too_many`
on `keys`), and answers `{ counts, ignored }` after the marks.

- A bad key is reported as `keys.<index>`: `not_seeable` for `proposal` and `reopened` keys, which
  leave by being handled, `invalid` for anything else that is not a well-formed `expiring` or `kev` key.
- Only keys listed in the user's Inbox right now are marked. The others, such as an item that left
  the Inbox or was marked before, are not stored and come back in `ignored`.
- At most 5000 marks are kept per user, more drop the oldest.
- A KEV mark holds only for the current listing: a CVE that leaves the catalog and returns shows again.
- Marks older than 30 days are deleted by the periodic cleanup.

`findings.kev_since` is written by the sync: the sync time when a finding is first seen KEV listed or
its flag turns on, cleared when the flag turns off. Findings without it do not show as new.

## Proposals

Claude files decision proposals through the MCP tool `propose_decision` (scope `sieb:propose`, see
[propose_decision](mcp.md#propose_decision)). A person accepts, edits or rejects them here. A proposal
never changes a decision, `/metrics`, the stats or the triage list until it is accepted. Accept and
reject write a log line with the proposal id, the acting user and the target, never the free text.
The reviewer's view is described in [Review proposals](../working-with-claude.md#review-proposals).

| Route | Purpose |
| --- | --- |
| `GET /api/proposals` | List, `state=open\|accepted\|rejected\|superseded\|all` (default `open`), optional `vulnId` |
| `GET /api/proposals/:id` | One proposal with sieb's facts |
| `POST /api/proposals/:id/accept` | Accepts, writes the decisions in one transaction |
| `POST /api/proposals/:id/reject` | Rejects with a reason |
| `POST /api/proposals/bulk-accept` | Accepts up to 100 unchanged |
| `POST /api/proposals/bulk-reject` | Rejects up to 100 with one reason |

An invalid `state` answers 400 `invalid`.

### The proposal object

`Proposal` (`src/core/proposal.ts`) carries these fields.

Target:

| Field | Meaning |
| --- | --- |
| `vulnId`, `scope`, `imageRefs` | `scope` is `image` or `all`, `imageRefs` sorted, `null` for scope `all`. Every target image needs an open finding of the CVE, scope `all` at least one |

Claims:

| Field | Meaning |
| --- | --- |
| `verdict` | `not_affected`, `accepted`, `fix_planned`, `needs_patch`, `inconclusive` |
| `justification` | OpenVEX value, required with `not_affected` only |
| `summary`, `confidence` | Text up to 1000 characters, `low`, `medium` or `high` |
| `presence`, `reachability`, `exposure` | Text up to 4000 characters each |
| `evidence` | `[{ check, method, result }]`, at most 30 |
| `fix` | See below |
| `review` | `{ date, why }`, `date` follows the `expiresAt` rules |
| `unknowns` | At most 20 entries of 1000 characters |
| `missing` | What is needed to decide: 1 to 10 entries of at most 1000 characters with `inconclusive`, `not_allowed` with any other verdict, `[]` otherwise |
| `references` | At most 20 http(s) URLs |
| `evidenceBasis` | At least one of `advisory`, `upstream_source`, `image`, `own_source`, `runtime` |

`fix` is `{ action, layer, fixedVersion, change, effort, availability, waitingFor, interim }`:

- `action` is one line of at most 160 characters, required for `needs_patch` and `fix_planned`.
- `layer` is optional and may be `null`: `dependency`, `base_image`, `image`, `platform` or `unknown`.
- `availability` is `available` or `upstream_pending` and may be `null` for other verdicts.
- `waitingFor` and `interim` (`{ action, steps, caveats }`) follow the rules in
  [waiting for upstream](mcp.md#propose_decision) and may be `null`.

Free text loses control characters, bidirectional formatting characters and invisible characters
(zero-width characters, the Arabic letter mark, soft hyphens). Treat all of it as untrusted plain text.

Same cause:

| Field | Meaning |
| --- | --- |
| `relatedFindings` | `[{ findingId, note }]`, at most 50, `note` up to 1000 characters or `null`. Other open findings Claude says share the cause. `[]` when none |
| `relatedReason` | One sentence up to 1000 characters naming the cause, `null` without related findings |

Accepting decides only the target, a related finding is decided on its own.

Snapshots and proposer:

| Field | Meaning |
| --- | --- |
| `imageAccess` | `[{ imageRef, imageVisibility, ownership }]` as proposed, see [Image access](#image-access) |
| `basisDecisions` | `[{ imageRef, decisionId, updatedAt }]`, the decisions governing the targets when proposed, `imageRef` `null` for the all-scope target |
| `proposedBy` | The sieb user of the token or OAuth login |
| `proposedVia` | `token` or `oauth` |
| `clientLabel`, `agent` | Token name or OAuth client label, free label the client gave itself |
| `clientKind` | See below |
| `createdAt` | Time of filing |

The id of the proposer's token is stored for the server log and never answered.

`clientKind` is derived by sieb when the proposal is filed, never text the client wrote. It may be
`null`, and the client then shows `agent` and `clientLabel` instead.

| Value | Source |
| --- | --- |
| `auto_check` | An Auto-check token |
| `claude_code_cli` | Claude Code entrypoint `cli` |
| `claude_code_headless` | Entrypoints `sdk-cli`, `sdk-ts`, `sdk-py` |
| `claude_code_vscode` | Entrypoint `claude-vscode` |
| `claude_code_app` | Entrypoint `claude-desktop` |
| `claude_code` | Any other Claude Code entrypoint, or clientInfo name `claude-code` |
| `claude_app` | The claude.ai connector (clientInfo name `Anthropic/ClaudeAI`), web, desktop and mobile alike |

The entrypoint comes from Claude Code's `User-Agent` (`claude-code/<version> (<entrypoint>)`). A client
that names itself only in `initialize` is matched through the last handshake of the same caller and
`User-Agent` this server process saw.

Outcome:

| Field | Meaning |
| --- | --- |
| `state` | `open`, `accepted`, `rejected`, `superseded` |
| `resolution` | `accepted`, `accepted_edited`, `rejected`, `replaced`, `other_accepted`, `finding_resolved` |
| `resolutionNote` | The reject reason |
| `decisionIds` | Decisions written by an accept |
| `resolvedAt`, `resolvedBy` | `resolvedBy` is `sieb` for a sync |

### Lifecycle rules

- A user holds one open proposal per target (CVE, scope and image set). A new one replaces the old
  one (`replaced`).
- At most 200 open proposals per user.
- Proposals an [Auto-check](#checks) files count apart: each check holds its own open proposal per
  target, never replaces the user's own proposal nor the other way round, and does not count against the 200.
- Accepting supersedes the other open proposals whose target overlaps (`other_accepted`).
- A sync supersedes a proposal once none of its images has an open finding left (`finding_resolved`).

### List and detail

`GET /api/proposals` answers `ProposalListItem[]`, newest first:
`{ proposal, outdated, severity, kev, imageCount }`.

- `outdated` is `true` for an open proposal when a decision governing one of its targets was created,
  changed or revoked since it was filed.
- `severity` and `kev` cover the open target findings, for scope `all` every open image.

`GET /api/proposals/:id` answers `ProposalDetail`, the list item plus:

| Field | Meaning |
| --- | --- |
| `images` | sieb's facts per target image (scope `all`: every image with an open finding), see below |
| `allScopeDecision` | The current all-scope decision of the CVE, else `null` |
| `currentDecisionIds` | `[{ imageRef, decisionId, updatedAt }]`, the governing decision per target now (`decisionId` and `updatedAt` both `null` for none). Send it back as `expectedDecisionIds` |
| `decisionValues` | What accepting without edits writes, `null` for `inconclusive` |
| `kevCatalog` | The CISA entry, `null` for other KEV sources |
| `related` | sieb's facts per related finding in the filed order |

Each entry of `images`:
`{ imageRef, findingId, open, severity, score, kev, exposure, owner, imageVisibility, ownership, checkAccess, versions, workloads, decision }`.
`versions` is `[{ package, installedVersion, fixedVersion }]`, `decision` the `DecisionView` governing
the image now.

`decisionValues` is `{ status, justification, reason, expiresAt, upstreamPending, waitingFor }`:

- `needs_patch` becomes `fix_planned`.
- A `fix_planned` with `fix.availability` `upstream_pending` waits for upstream with its `waitingFor`.
- The reason is generated from verdict, summary, the first three evidence checks, the fix and the
  confidence, at most 2000 characters.
- The expiry is the review date while it lies ahead, else the default of the status.

Each entry of `related`:
`{ findingId, note, vulnId, imageRef, open, imageVisibility, ownership, versions, decision, effective }`.
`decision` and `effective` describe the decision governing the finding now (`null` when undecided).
`vulnId`, `imageRef`, `imageVisibility` and `ownership` are `null` once sieb no longer holds the finding.

### Accept and reject

`POST /api/proposals/:id/accept` takes:

```json
{
  "expectedDecisionIds": [
    { "imageRef": "registry.example.com/acme/shop", "decisionId": null, "updatedAt": null }
  ],
  "edits": {
    "status": "accepted",
    "justification": null,
    "reason": "Reviewed with the platform team.",
    "expiresAt": "2026-09-01",
    "upstreamPending": false,
    "waitingFor": null
  }
}
```

`edits` is optional. Any other field, such as `scope` or `imageRefs`, is `not_allowed`.

- Edits follow the decision rules and answer `edits.<field>` with `invalid`, `not_allowed`,
  `too_long`, `in_past`, `too_far` or `required`, also for the merged values. A waiting proposal whose
  review date passed needs `edits.expiresAt`.
- In one transaction the accept writes, per target image, the image-scoped decision (updating and
  re-confirming an existing one), or for scope `all` the all-scope decision.
- It answers `{ proposal, decisions, supersededIds }` with the written decisions as `DecisionView`.
- The `created` or `updated` events of those decisions carry
  `provenance: { proposalId, proposedBy, clientLabel, editedFields }`.
- An `inconclusive` proposal is accepted only with `edits.status` and `edits.reason`, the reviewer's own
  decision (resolution `accepted_edited`). Without a status edit the accept answers 409
  `not_acceptable`, without a reason 400 `edits.reason` `required`. The UI calls this **Decide
  myself**.

`POST /api/proposals/:id/reject` takes `{ "reason" }`, 1 to 2000 characters (`required`, `too_long`),
and answers `{ proposal }`. The proposer reads the reason back through `list_my_proposals`. The UI
calls this **Dismiss**.

| Status | Body | When |
| --- | --- | --- |
| 404 | `not_found` | Unknown proposal |
| 409 | `{ "error": "proposal_conflict", "currentDecisionIds" }` | A governing decision is no longer the expected one, or was edited since (same `decisionId`, other `updatedAt`). Nothing is written |
| 409 | `{ "error": "proposal_closed", "state" }` | The proposal is no longer open |
| 409 | `{ "error": "not_acceptable" }` | An `inconclusive` proposal accepted without `edits.status` |
| 400 | `expectedDecisionIds` `required` or `invalid` | An entry without `updatedAt`, with an unparsable one, or with an `updatedAt` but no `decisionId` is `invalid` |

### Bulk accept and reject

Both routes take 1 to 100 distinct proposals (`items` or `ids`: `required`, `invalid`, `too_many`,
`duplicate`) and handle them one at a time, each in a transaction of its own. An outcome never depends
on a later proposal of the batch. Both answer 200 `{ results: [{ id, vulnId, outcome }] }` in request
order, with `vulnId` `null` for an unknown proposal, and log every write as the single routes do.

`POST /api/proposals/bulk-accept` takes
`{ "items": [{ "id", "expectedDecisionIds": [{ "imageRef", "decisionId", "updatedAt" }] }] }`.
The expected decisions are read as for the single accept (errors as `items[<n>].expectedDecisionIds`).
It accepts without edits and never forces a proposal.

`POST /api/proposals/bulk-reject` takes `{ "ids": [...], "reason" }`, the reason under the rules of
the single reject, the same for every proposal.

| `outcome` | Meaning |
| --- | --- |
| `accepted` | Accepted unchanged, as the single accept without edits writes it |
| `rejected` | Rejected with the reason |
| `outdated` | Skipped, a governing decision changed since filing or is not the expected one |
| `inconclusive` | Skipped, an inconclusive proposal never becomes a decision without a review |
| `not_acceptable` | Skipped, the accept refused it for another reason |
| `not_open` | Skipped, accepted, rejected or superseded meanwhile, also by an earlier entry |
| `not_found` | No such proposal |

## Image access

Two separate facts describe each image. They appear in the finding detail, the proposal detail (with
a snapshot per target in `proposal.imageAccess`) and the MCP finding rows. The user-facing meaning
is in [Ownership and visibility](../triage.md#ownership-and-visibility).

`ownership` is `own` for the owner label `self`, else `third_party`.

`imageVisibility` says whether the image can be pulled:

| Value | Meaning |
| --- | --- |
| `public` | Pullable anonymously |
| `credential` | Not known to be public, but a usable registry credential covers it |
| `restricted` | The anonymous pull was refused and no credential covers it |
| `unknown` | Not probed yet, the probe failed for another reason, or a third-party image elsewhere |

How sieb decides:

- A third-party image on a registry of `SIEB_PUBLIC_REGISTRIES` counts as `public` without a probe.
  One that turns out private fails at the fetcher's pull with the registry's reason.
- A third-party image on any other registry is `credential` when a credential covers it, else `unknown`.
- An image without a registry host counts as Docker Hub.

### Pull probe

Own images are probed on demand, never in the background:

| Trigger | Wait for the probe |
| --- | --- |
| Finding detail of an own image | At most 1.5 seconds |
| Before checks are queued | At most 6 seconds |
| MCP tools `get_finding` and `check_vulnerability` | At most 3 seconds |

The hand-off and the lists answer from the cache.

The probe sends `HEAD /v2/<path>/manifests/<digest or tag>` without credentials. On a `Bearer`
challenge it asks the challenge's realm for an anonymous pull token and repeats the `HEAD` with it. It
reads no manifest body and pulls nothing.

- `200` is `public`, `401` or `403` (also from the token realm) is `restricted`.
- Anything else, a timeout (5 seconds per request, 8 per probe) or a refused address is a failure.
- It uses the credential test's fetch: https only, port 443 or the port the image reference names, no
  redirects, only public addresses. A registry on a private or in-cluster address is never probed and
  stays `unknown`.
- A cached answer stays fresh for 7 days when `public`, 24 hours when `restricted` and 1 hour after
  a failure. A stale answer still counts until the next probe replaces it.
- Concurrent requests share one probe per image, and at most 10 probes start per minute across
  sieb. An image beyond that keeps its cached or `unknown` visibility.
- Mock mode probes nothing.

### Check access

`checkAccess` in the finding detail lists how Auto-check reaches the image as `ImageCheckAccess`
`{ imageRef, level, credentialId, credentialLabel }`. `level` is `credential` when a usable registry
credential covers the image (with its id and label), else `public` for the visibility `public`, else
`none`. While private access is off it is never `credential`. Unlike `imageVisibility`, which prefers
`public` over `credential` because it describes the image, `checkAccess` names the credential first,
since the fetcher then pulls with it.

## Tokens and Claude connection

Personal tokens authenticate `claude -p`, CI and scripts on [`/mcp`](mcp.md#endpoint-and-authentication).
See [Connect](../working-with-claude.md#connect) for how users create them.

The routes need a user of the UI login (401 `{ "error": "unauthorized" }` without one), never a token,
answer `Cache-Control: no-store`, and a user only sees, revokes and deletes their own tokens. While
`SIEB_MCP_ENABLED` is off every `/api/tokens` request answers 404 `{ "error": "mcp_disabled" }` and
stored tokens stay untouched.

| Route | Purpose |
| --- | --- |
| `GET /api/tokens` | Own tokens, revoked and expired included, newest first |
| `POST /api/tokens` | Creates a token, answers 201 with its secret once |
| `POST /api/tokens/:id/revoke` | Revokes an own token and answers it |
| `DELETE /api/tokens/:id` | Deletes an own revoked or expired token, answers 204 |
| `POST /api/tokens/cleanup` | Deletes all own revoked and expired tokens, answers `{ deleted }` |

A token is answered as `{ id, name, scope, prefix, createdAt, expiresAt, lastUsedAt, revokedAt }`,
never with owner, hash or secret.

| Field | Meaning |
| --- | --- |
| `scope` | `read` (grants `sieb:read`) or `propose` (also `sieb:propose`, which offers `propose_decision`) |
| `prefix` | `sieb_` and the first 8 characters of the secret |
| `lastUsedAt` | `null` until first use, written at most once a minute |
| `expiresAt` | A date-time. A token without an expiry is not accepted on `/mcp` |

The token a running [Auto-check](#checks) holds is internal. It is not listed, does not count against
the cap, and revoke and delete answer 404 for it. Cancelling the check ends it.

`POST /api/tokens` takes `{ "name", "scope", "expiresAt" }` and answers 201
`{ "token", "secret" }`, the only time the secret leaves the server.

| Field | Rule |
| --- | --- |
| `name` | Trimmed, 1 to 64 characters without control characters (`required`, `too_long`, `invalid`) |
| `scope` | `read` or `propose` (`required`, `invalid`) |
| `expiresAt` | Required, never `null` (`required`). Follows the `expiresAt` rules of [Request rules](#shared-field-rules) and lies at most 365 days ahead (`too_far`). A date-only value ends that day, so one day of slack applies |

A user holds at most 20 live tokens (neither revoked nor expired), one more answers 409
`{ "error": "too_many_tokens" }`.

- Revoking again keeps the first revocation. An unknown id or another user's token answers 404.
- A revoked token is refused on the next request and stays in the list until its owner deletes it,
  or the cleanup deletes revoked and expired tokens 90 days later.
- `DELETE` of a live token answers 409 `{ "error": "token_live" }`, revoke it first.
- `POST /api/tokens/cleanup` takes `{}` and deletes in one transaction.

Proposals filed with a deleted token keep `proposedBy`, `proposedVia` and `clientLabel`. A new token
always gets an id above every token id and every token id a proposal stores, so it never takes over a
deleted one.

The secret is `sieb_` and 32 random bytes in base64url. sieb stores only its sha-256 hash. Every
create, revoke and delete writes a log line with owner, name, id and scope, never the secret.
`POST /api/tokens/cleanup` writes one line per deleted token.

### MCP information

`GET /api/mcp-info` is available whether MCP is on or off and answers `Cache-Control: no-store`:

```json
{
  "enabled": true,
  "mcpUrl": "https://sieb.example.com/mcp",
  "oauth": true,
  "claude": { "connected": true, "activeTokens": 1, "oauthLastSeenAt": "2026-06-01T10:00:00.000Z" },
  "checksEnabled": true
}
```

| Field | Meaning |
| --- | --- |
| `enabled` | `SIEB_MCP_ENABLED` |
| `mcpUrl` | Absolute endpoint URL on `SIEB_PUBLIC_URL`, else on the origin of the request. `null` while disabled |
| `oauth` | `true` when MCP is on and OAuth is configured |
| `claude` | `null` while MCP is off or the request has no user |
| `checksEnabled` | `SIEB_CHECKS_ENABLED` |

`claude` is `{ connected, activeTokens, oauthLastSeenAt }` for the acting user:

- `activeTokens` counts personal tokens that are neither revoked nor expired, the token of a running
  Auto-check left out.
- `oauthLastSeenAt` is the last MCP request authenticated through OAuth, of any age.
- `connected` is `true` with at least one active token or an OAuth request within the last 30 days.

The client hides the token dialog, the hand-off button and its keys while `enabled` is `false`, and
disables the deep-link hand-off and the `claude` command while `connected` is `false`.

Every authenticated `/mcp` request past the rate limit updates the connection record, at most once
per user and kind every five minutes through an in-memory throttle. A failed write is logged and does
not fail the request.

## Checks

With `SIEB_CHECKS_ENABLED=true` (needs `SIEB_MCP_ENABLED`, `SIEB_PUBLIC_URL`, `SIEB_WORKER_PORT` and
`SIEB_WORKER_SECRET`), users queue findings for a headless Claude Code run. A separate worker polls
sieb on its own listener, investigates one check at a time and files a normal proposal through `/mcp`
with a short-lived token of the requester bound to the check. How the worker runs is described in
[Auto-check](../auto-check.md).

| Route | Purpose |
| --- | --- |
| `GET /api/checks` | The queue, the recent checks and the usage |
| `POST /api/checks` | Queues checks, needs a user |
| `DELETE /api/checks/:id` | Cancels a queued or running check, needs a user |

A check is `queued`, `running`, `done`, `failed` or `cancelled`. Queued and running count as open. A
running check has a `phase` of `preparing`, `investigating` or `reporting`.

### Rules

- Only open findings whose image has the visibility `public` or `credential` can be queued, and each
  finding has at most one open check. Ownership plays no part: an own image that is anonymously
  pullable is checkable without a credential.
- At most 500 checks are open at once, a guard against accidental floods. There is no daily limit.
  Findings beyond that are skipped as `queue_full`.
- The worker claims checks oldest first, at most one check runs at a time.
- A running check fails with an error saying so when it has no heartbeat for 2 minutes, or runs longer
  than `SIEB_CHECK_TIMEOUT_SECONDS` plus one minute. sieb evaluates this on every claim, heartbeat and
  read of `/api/checks`, and every 30 seconds.
- A queued check fails without starting when, by the time it is claimed, its finding is gone or
  resolved, its image is neither public nor covered by a usable registry credential any more, or sieb
  knows neither a digest nor a tag of the scanned image. sieb never hands out a bare image reference,
  which would pull `latest`.
- With `SIEB_AUTH=oidc`, when sieb refuses a login because the user lost the required group, it fails
  that user's open checks and deletes the running check's token. sieb cannot see a removal at the
  identity provider before that login, nor any removal in `header` mode. A check queued by such a user
  still runs until it ends or someone cancels it.
- Every signed-in user may cancel any check. All users share one queue. The cancelling user is logged.

### Reading the queue

`GET /api/checks` answers `{ enabled, workerOnline, running, queued, recent, usage }`.

| Field | Meaning |
| --- | --- |
| `workerOnline` | The worker reached sieb within the last 90 seconds (three heartbeat intervals, more than the longest idle poll of 60 seconds) |
| `running` | The running `CheckView`, else `null` |
| `queued` | The queue in claim order |
| `recent` | At most 50 ended checks, newest first |
| `usage` | `{ last7Days, last30Days }` over the checks of all users that ended in the window |

A `CheckView` is
`{ id, findingId, vulnId, imageRef, requestedBy, state, phase, position, createdAt, startedAt, finishedAt, durationMs, error, proposalId, usage, reply, pulledDigest, pulledImages, source }`.

| Field | Meaning |
| --- | --- |
| `phase` | Running checks only |
| `position` | 1-based queue position, queued checks only |
| `error` | Short reason of a failed check |
| `proposalId` | The proposal filed with the check's token, else `null` |
| `usage` | `{ inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd, turns, models }` as the worker reported, `null` when it reported none. `models` is optional: ids of the models that ran, most output tokens first, at most 8 |
| `reply` | Claude's final reply, untrusted plain text, at most 4000 characters |
| `pulledDigest` | Digest of the primary image the worker exported, `null` when it reported none |
| `pulledImages` | Every exported image, primary first, as `{ digest, tag }`. `tag` is the tag an instance of the finding names for that digest (for a pull by tag the claimed tag), else `null`. Empty when the worker reported nothing |
| `source` | The repository checked out for the primary image, `{ repoUrl, revision, fromLabel, refKind, ref }`, else `null` |

`costUsd` is the API-equivalent estimate `claude -p` reports (billed with an API key, counted against
plan limits with a subscription), or `null`.

A usage window is `{ days, checks, withUsage, inputTokens, outputTokens, cacheTokens, costUsd, averageDurationMs }`:

| Field | Meaning |
| --- | --- |
| `checks` | Done, failed and cancelled checks that ended in the window |
| `withUsage` | Those whose worker reported usage. The token sums and `costUsd` cover only those |
| `costUsd` | Sum of the estimates, `null` when no check in the window reported one |
| `averageDurationMs` | Over the done and failed checks with a duration, `null` without one |

While `SIEB_CHECKS_ENABLED` is off, `GET /api/checks` answers
`{ "enabled": false, "workerOnline": false, "running": null, "queued": [], "recent": [], "usage": null }`
and every write 404 `{ "error": "checks_disabled" }`.

### Queue checks

`POST /api/checks` takes `{ "findingIds": [...], "force"?: boolean }`: 1 to 100 positive integers
(`required`, `invalid`, `too_many`), repeated ids counted once. `force` must be a boolean (`invalid`).
It first probes own images without a fresh probe answer, see [Pull probe](#pull-probe). It answers:

```json
{
  "queued": [],
  "skipped": [{ "findingId": 12, "reason": "covered_by_proposal", "proposalId": 3 }]
}
```

`queued` holds `CheckView`s. The skip reasons are checked in this order:

| `reason` | Meaning |
| --- | --- |
| `not_found` | No such finding |
| `resolved` | The finding is resolved |
| `not_public` | The image is neither public nor covered by a credential |
| `visibility_unknown` | An own image of unknown visibility and no credential covers it |
| `already_open` | The finding has an open check |
| `covered_by_proposal` | An open proposal lists the finding as a related finding, `proposalId` names the newest one |
| `queue_full` | 500 checks are open |

`visibility_unknown` happens when the probe did not answer in time, the rate limit held it back, or it
failed. A probe always fails for a registry on a private or in-cluster address: add a registry
credential for those. A proposal's own targets are not covered. `force: true` queues covered findings
anyway and changes nothing else. The first four reasons come from `findingCheckBlocker` in
`src/core/checkEligibility.ts`, which the claim and the client use as well.

The Retry action on a failed or cancelled check sends this request again for the check's finding.

### Cancel a check

`DELETE /api/checks/:id` cancels a queued or running check of any user and answers 204. A running
check's token is deleted at once and the worker's next heartbeat gets 409. An ended check answers 409
`{ "error": "check_finished" }`, an unknown id 404.

## Access credentials

Read credentials let Auto-check pull private images and clone the source of own images, for GitHub
(`ghcr.io`, `github.com`), GitLab (`registry.gitlab.com` and `gitlab.com`, or a self-hosted instance)
and Docker Hub. Setup and use are in [Private access](../auto-check.md#private-access).

They need `SIEB_CREDENTIALS_KEY`. A registry credential makes an image checkable only while
Auto-check, the key and `SIEB_FETCHER_SECRET` are all set. A credential covers a registry host and/or
a git host plus a path prefix, matched in whole segments. When several cover a target, the longest
prefix wins. There is no allow list: every image a registry credential covers is eligible for
Auto-check.

| Route | Purpose |
| --- | --- |
| `GET /api/credentials` | `{ enabled, fetcherConfigured, credentials }`, oldest first |
| `POST /api/credentials` | Stores a credential once its test passed, answers 201 |
| `PATCH /api/credentials/:id` | Changes a credential |
| `DELETE /api/credentials/:id` | Deletes, answers 204 |
| `POST /api/credentials/test` | Tests entered values without storing anything |
| `POST /api/credentials/:id/test` | Tests a stored credential and stores the outcome |

Every route needs a user (401 `{ "error": "unauthorized" }` without one), follows the
[Request rules](#request-rules) for writes and answers `Cache-Control: no-store`. Any signed-in user
may add, change, test and delete any credential, like the shared check queue.

Without the key, `GET /api/credentials` answers `{ "enabled": false, "fetcherConfigured": …, "credentials": [] }`
and every other request 404 `{ "error": "credentials_disabled" }`. `fetcherConfigured` is `false`
while Auto-check or `SIEB_FETCHER_SECRET` is off.

A credential is answered as `AccessCredentialView`, never with its secret:

| Field | Meaning |
| --- | --- |
| `id`, `provider`, `label`, `uses` | `provider` is `github`, `gitlab` or `dockerhub`, `uses` a list of `registry` and `git` |
| `registryHost`, `gitHost` | Stored only for the uses the credential has, else `null` |
| `pathPrefix`, `repoMapping`, `username` | Readable, the username so the list can show it |
| `createdBy`, `createdAt`, `updatedAt` | Provenance |
| `lastUsedAt` | The last time it was handed to the fetcher, else `null` |
| `lastTest` | `AccessTestResult`, else `null` |
| `secretReadable` | `false` when the configured key cannot open the stored secret |

A credential with `secretReadable: false` was sealed with another key or its row was changed outside
sieb. It covers nothing until its secret is entered again: `checkAccess` answers `none` for its images,
queueing skips them as `not_public`, it shadows no other credential and the fetcher gets no login
from it.

### Create and change

`POST /api/credentials` validates per field (`required`, `invalid`, `too_long`, `not_allowed` or
`outside_scope`):

| Field | Rule |
| --- | --- |
| `provider` | `github`, `gitlab` or `dockerhub` |
| `label` | Trimmed, 1 to 64 characters without control characters |
| `uses` | Non-empty list of `registry` and `git` the provider supports. Docker Hub has no git (`not_allowed`) |
| `registryHost`, `gitHost` | Default to the provider's hosts. Only GitLab takes custom hosts (others `not_allowed`): a lower-case DNS name with at least one dot and an optional port, no IP address. Docker Hub aliases fold into `docker.io` |
| `pathPrefix` | Required, `''` covers the whole host. Stored trimmed, lower case, without leading and trailing slashes, at most 200 characters of segments (`[a-z0-9_][a-z0-9._-]*`, no `.` or `..`) |
| `repoMapping` | `null` or `{ registryPrefix, repoPrefix }`, each `host/path` without scheme, stored lower case without trailing slash. `repoPrefix` needs a path |
| `username` | Required for GitLab and Docker Hub, optional for GitHub. Printable ASCII without spaces, at most 200 characters, no `:` |
| `secret` | Required on create. Printable ASCII without spaces, at most 4096 characters |
| `confirmUntested` | Boolean (`invalid` otherwise), see [Test before storing](#test-before-storing) |

A `repoMapping` stays within the credential (`outside_scope` otherwise):

- `registryPrefix` lies on the credential's registry host and within its path prefix.
- `repoPrefix` lies within the same path prefix on its git host: for a credential without the use `git`
  on the provider's git host (`github.com`, `gitlab.com` for `registry.gitlab.com`), for a self-hosted
  GitLab on any host.
- Docker Hub has no git host and no mapping. Its images get their source from the source label alone.

Limits and conflicts, both checked before the test:

| Status | Body | When |
| --- | --- | --- |
| 409 | `too_many_credentials` | 50 credentials are stored |
| 409 | `duplicate_scope` | Two credentials claim the same host and prefix for a shared use |

`PATCH /api/credentials/:id` takes the same fields, merged over the stored ones, and answers the view.
`secret` replaces the stored secret, leaving it out keeps it.

- A change of anything but the label, a new `secret` included, is tested first like a create, and its
  passing test replaces `lastTest`.
- A change of the label alone runs no test and keeps `lastTest`.
- A credential whose secret was sealed with another key needs a new `secret` (409
  `{ "error": "secret_unreadable" }`).
- So does a change of the provider or to a registry or git host the credential did not have (409
  `{ "error": "secret_required" }`). A stored token is write-only and never goes to a host it was not
  entered for. Removing a use needs none.

`DELETE /api/credentials/:id` answers 204, an unknown id 404. Revoke the token at the provider too.

Each create, update, delete and test of a stored credential writes one log line with the acting
user, id, provider, label, hosts and prefix (a test adds `registry=<ok>/<checked>` and `git=…`), never
the username or secret. A dry run and a refused save write none.

### Test before storing

`POST /api/credentials` and a `PATCH` beyond the label test the submitted values first, with the secret
held in memory only. The test is the one of `POST /api/credentials/:id/test`, with a submitted
repository mapping in place of the stored one.

Per use the credential has, the test passes when at least one target was reachable and no target
answered `401 unauthorized` or `403 forbidden`. Other failures of single targets, such as `not found`
for an image that moved on or a `timeout`, do not block while one target of that use passed.

Otherwise the request answers 422 with the result and writes nothing, no row, no change and no log
line. The body never carries the secret:

```json
{
  "error": "test_failed",
  "result": {
    "at": "2026-06-01T10:00:00.000Z",
    "registry": { "checked": 2, "ok": 1, "failures": [], "denied": 1, "blocked": 0 },
    "git": null
  }
}
```

| `error` | When |
| --- | --- |
| `test_failed` | A target of any use answered 401 or 403, or no target of a use was reachable |
| `nothing_to_test` | A use covers no image or repository sieb has seen, so the token cannot be proven. Fix the path prefix or mapping |
| `untestable` | Every target of a use was refused as `address not allowed`, a host on a private or in-cluster address sieb never tests. Send the request again with `confirmUntested: true` to store it untested |

When the uses differ, the first code of the table that applies to one of them is answered. Validation
errors (400) and the 409 refusals (`duplicate_scope`, `too_many_credentials`, `secret_required`,
`secret_unreadable`) come first and run no test.

With `confirmUntested: true` a save whose only obstacle is `untestable` is stored, and its `lastTest`
carries `untested: true`. It never lets a refused login or a prefix without targets through.
`confirmUntested` is not stored.

### Test routes

`POST /api/credentials/:id/test` takes `{}`, tests the credential from sieb over HTTPS and answers the
view with the new `lastTest`. A secret the key cannot open answers 409 `secret_unreadable`. This test
stores its outcome whatever it is and never removes the credential.

`POST /api/credentials/test` takes an `AccessCredentialInput` and answers the `AccessTestResult` of
those values, the same test without storing anything and without a log line.

- For a stored credential it takes `{ id, ...changes }`, merged over the stored fields like a `PATCH`,
  and uses the stored secret unless `secret` gives a new one.
- The stored secret never goes to a new provider or host (409 `secret_required`). One the key cannot
  open answers 409 `secret_unreadable`, an unknown id 404, an `id` that is no positive integer 400.

`AccessTestResult` is `{ at, registry, git }` plus an optional `untested: true`. Each part is
`{ checked, ok, failures, denied, blocked }`, `null` for a use the credential lacks. `failures` holds
at most 5 entries `{ target, reason }`. `denied` counts the targets that answered `401 unauthorized` or
`403 forbidden` and `blocked` those refused as `address not allowed`, both over all failures. Both
fields may be absent.

What the test requests:

| Part | Request |
| --- | --- |
| Registry | Resolves the manifest (`HEAD /v2/<path>/manifests/<digest or tag>`) of up to 20 images of sieb's findings the credential covers, open ones first. It uses the OCI distribution auth flow: an anonymous request, then on 401 the Bearer token from the `WWW-Authenticate` realm with basic auth, or basic auth itself. Docker Hub goes through `registry-1.docker.io` and `auth.docker.io` |
| Git | `GET https://<host>/<path>.git/info/refs?service=git-upload-pack` with basic auth for up to 20 repositories: those the repository mappings derive from sieb's images, those the default mappings name for them, and those checks reported as checked out |

Address rules, which also apply to the token realms:

- Every request goes over https to port 443, or to the port the credential's host names, and only to
  public addresses.
- sieb refuses cluster-internal names (single labels, `localhost`, `*.local`, `*.svc`,
  `*.cluster.local`, `*.internal`, `*.home.arpa`).
- It resolves every other host itself and refuses it when any address is loopback, private (RFC 1918),
  CGNAT (`100.64.0.0/10`), link-local with the cloud metadata endpoints, unique-local IPv6,
  unspecified, multicast or reserved, also mapped into IPv6 or NAT64. It connects to exactly the
  addresses it vetted, so DNS rebinding cannot swap them (`address not allowed`, `port not allowed`).
- A registry or GitLab on a private address or an internal name, such as an in-cluster registry,
  therefore cannot be tested from sieb, while the fetcher still uses its credential.
- Requests never follow a redirect (`redirect refused`).
- The credential goes to a token realm only on a host of the credential, the registry's API host or a
  known auth host of its provider (`ghcr.io` for GitHub, `gitlab.com` for `registry.gitlab.com`,
  `auth.docker.io` for Docker Hub, none for a self-hosted GitLab, whose realm must be its registry or
  git host), never on a parent domain (`token realm on another host` otherwise).
- Each request stops after 10 seconds and each test after 45 seconds (`timeout`).

Failure reasons: `401 unauthorized`, `403 forbidden`, `not found`, `429 rate limited`, `unreachable`,
`no token`, `unexpected answer`, plus the refusals above.

Throttle: a stored credential is tested at most once per 10 seconds and at most 3 tests run at once,
else 429 `{ "error": "test_cooldown" }` or `{ "error": "tests_busy" }` with `Retry-After: 10`. A test
that did not run, such as one answering `secret_unreadable`, does not count. Tests of entered values,
the dry run included, are throttled per user: one at a time and one start per 10 seconds, sharing the
limit of 3 running tests.

A save of exactly the values, secret included, that the same user tested within those 10 seconds
reuses that result instead of a second run. So **Test only** followed by a save sends no further
requests. sieb keeps only an HMAC of the values under a key that lives in memory, never the secret.

### Storage

Username and secret are sealed together with AES-256-GCM under `SIEB_CREDENTIALS_KEY`, with a random
12-byte nonce per seal. The associated data holds a seal format version, the row id, the provider, the
registry and git host and the path prefix.

- A ciphertext copied into another row, or a row whose provider, hosts or prefix a database writer
  changed, fails to open, so a sealed secret cannot be pointed at another host.
- A change through the API seals it again for the new fields.
- The ciphertext starts with the format version byte (1).
- Each row stores the id of the key that sealed it, a truncated sha-256 of the key.
- Provider, hosts, prefix, mapping and username stay readable.

Rotation of the key is described in [Secrets and rotation](../operations.md#secrets-and-rotation).

## Login routes

Mounted only with `SIEB_AUTH=oidc`, outside `/api` and without a session. Setup and flow are in
[Authentication](../deployment.md#authentication).

| Route | Purpose |
| --- | --- |
| `GET /auth/signin?return=/path` | Static sign-in page with a "Sign in with SSO" button to `/auth/login` with the same return rule. `signedOut=1` adds "You are signed out of sieb." Clears the signed-out cookie, and with a valid session redirects (302) to the return path |
| `GET /auth/login?return=/path` | Starts the login and redirects (302) to the identity provider. `return` must be a relative path (`/` and not `//` or `/\`), anything else returns to `/`. A 503 page when the provider cannot be reached |
| `GET /auth/callback` | Redirect target of the provider: creates the session, sets the session cookie and redirects to the return path |
| `POST /auth/logout` | Same rules as `/api` writes (`Content-Type: application/json`, same origin). Deletes the session, clears the cookie, sets the signed-out cookie for 5 minutes and answers `{ redirect }` |

`/auth/callback` answers a 400 page for a provider error, an unknown or expired login, a failed code
exchange or a missing `preferred_username`, a 403 page for a missing required group, and a 503 page for
an unreachable provider. Each carries a link to `/auth/login`.

`redirect` of the logout is the provider's end-session URL with `id_token_hint` and
`post_logout_redirect_uri` set to the public URL, or the public URL when the provider has no
end-session endpoint.

### Session guard

Without a session:

- Page requests (`GET` or `HEAD` of a client route) redirect to `/auth/signin?return=<path and query>`,
  with `&signedOut=1` while the signed-out cookie is present.
- Everything else under `/api` and any other file answers 401.
- Public without a session: `/auth/*`, `/api/health`, the favicon, the icons and `site.webmanifest`,
  and, while MCP is enabled, `/mcp` and `/.well-known/oauth-protected-resource*`.

### Cookies

Over an https `SIEB_PUBLIC_URL` the cookies carry the `__Host-` prefix and `Secure`. Over plain http,
allowed outside production only, they drop both.

| Cookie (https / http) | Content | Lifetime |
| --- | --- | --- |
| `__Host-sieb_session` / `sieb_session` | Session id, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain` | `SIEB_SESSION_HOURS` |
| `__Host-sieb_login` / `sieb_login` | The pending login (state, nonce, PKCE verifier, return path), sealed | 10 minutes |
| `__Host-sieb_signedout` / `sieb_signedout` | Marks a deliberate sign-out | 5 minutes |

The redirect URI is `SIEB_PUBLIC_URL/auth/callback`, never derived from request headers.

## Metrics

`GET /metrics` serves the Prometheus text format without authentication and without a `Host` check. It
exposes the suppression series `sieb_suppressed{vuln_id, image_ref}`, the sync series, the decision
counts and the Auto-check series.

With `SIEB_METRICS_PORT` it is served on that port only, and the main port answers 404. In `oidc` mode
this is always the case. The series, their labels and the all-scope expansion are listed in
[Health and metrics](../operations.md#health-and-metrics), the alert examples in
[Prometheus rules](../prometheus-rules.md#auto-check-alerts).

## Worker listener

With Auto-check on, a second listener on `SIEB_WORKER_PORT` serves only the `/worker` routes. The main
port does not serve them. A worker and a fetcher reach it by service name.

- There is no `Host` check on this listener. The secrets are the defence.
- Bodies are JSON of at most 32 KiB (413 otherwise) and are validated against the types in
  `src/core/check.ts` (400 `validation` otherwise).
- The worker routes need `Authorization: Bearer <SIEB_WORKER_SECRET>`, compared in constant time, else
  401 `{ "error": "unauthorized" }` with `WWW-Authenticate: Bearer`. Every authenticated worker request
  counts as a sign of life for `workerOnline`.
- The two fetcher routes take only `SIEB_FETCHER_SECRET`, and that secret passes nowhere else.
  Fetcher requests are no sign of life of the worker.

### Worker routes

| Route | Purpose |
| --- | --- |
| `POST /worker/claim` | Hands out the next check |
| `POST /worker/checks/:id/heartbeat` | Keeps a running check alive |
| `POST /worker/checks/:id/result` | Ends a check |

`POST /worker/claim` answers 200 `WorkerClaim`, or 204 without a body while a check runs or the queue is
empty.

| Field | Meaning |
| --- | --- |
| `checkId`, `findingId`, `vulnId` | The check |
| `imageRef`, `imageDigest` | The primary image |
| `images` | Up to 3 entries `{ imageRef, imageDigest, tag }`, the primary first |
| `prompt` | The chat hand-off prompt plus a note that nobody answers questions. The worker appends its workspace layout |
| `mcpUrl` | `/mcp` on `SIEB_PUBLIC_URL` |
| `token` | Check-bound token, see below |
| `timeoutSeconds`, `maxTurns` | Limits of the run |

`images` holds one entry per distinct digest of the open instances, most recently seen first. `tag` is
the tag of the newest instance with that digest, `null` when none names one, and the prompt names the
open tags no image covers. The primary image is `repository@digest`. Without any digest, the single
image is `repository:tag` of the most recently seen open instance and `imageDigest` is `null`: the tag
may have moved since the scan, the prompt says so, and the worker resolves and reports the digest it
pulled. A worker refuses a list that does not start with the primary image, repeats a reference or has
a further image without digest.

`token` is a token of the requester named `Auto-check #<id>` with scope `propose`. It is minted on claim
outside the 20 live token cap and the user-facing lifetimes, and expires 10 minutes after
`SIEB_CHECK_TIMEOUT_SECONDS`.

- It is bound to its check: on `/mcp` it reaches only the check's finding, CVE and image, see
  [Auto-check tokens](mcp.md#auto-check-tokens). It stops working once the check no longer runs.
- It is hidden from the requester's [tokens](#tokens-and-claude-connection) and Claude connection.
  The claim answer is the only place its secret appears.
- When the check ends, by result, cancel or timeout, sieb links the newest proposal filed with the
  token as `proposalId`, then deletes the token. The proposal keeps its attribution.
- Each claim, end and timeout writes one log line, each minted and deleted token the usual token log
  line, none with the secret.

`POST /worker/checks/:id/heartbeat` takes `{ "phase" }` and answers 204. Once the check was cancelled
or timed out it answers 409 `{ "error": "check_not_running" }`, which tells the worker to stop.

`POST /worker/checks/:id/result` takes:

```json
{
  "status": "done",
  "error": null,
  "durationMs": 412000,
  "usage": null,
  "reply": "…",
  "pulledDigest": "sha256:…",
  "pulledDigests": ["sha256:…"],
  "source": null
}
```

It answers 204, 409 for a check that is no longer running, 404 for an unknown one.

| Field | Rule |
| --- | --- |
| `status` | `done` or `failed` |
| `error` | Cut to 500 code points |
| `reply` | Cut to 4000 code points (`capText` in `src/core/checkLimits.ts`, which also holds the bounds of the timeout and the turns) |
| `pulledDigest` | Optional, an `algorithm:hex` digest of the primary image |
| `pulledDigests` | Optional, digests of every exported image, primary first. Repeated digests count once, entries past the third are dropped, a list that does not start with `pulledDigest` is `invalid`. Without the list `pulledDigest` counts as the single image |
| `source` | Optional, `null` or `CheckedSource` |

`CheckedSource` is `{ repoUrl, revision, fromLabel, refKind, ref }`:

| Field | Rule |
| --- | --- |
| `repoUrl` | An https repository URL without credentials, at most 500 characters, stored normalised as `https://<host>/<path>.git` |
| `revision` | `null` or the checked-out commit of 7 to 64 hex digits |
| `fromLabel` | Boolean, `true` when the image's source label named the repository |
| `refKind` | What chose the commit: `label` (the revision label), `tag` (the git tag matching the image tag) or `default_branch` |
| `ref` | The tag for `tag` (letters, digits and `._+-`, at most 129 characters, no `..`, not starting with `-` or `.`, not ending in `.` or `.lock`), else `null` |

Errors on `source` are reported as `source.repoUrl`, `source.revision`, `source.fromLabel`,
`source.refKind` and `source.ref` with `required` or `invalid`.

### Fetcher routes

The fetcher pulls a check's images and clones its source into the volume it shares with the checker, so
only it ever holds a credential, and only per check. Without `SIEB_FETCHER_SECRET` both routes answer
404 `{ "error": "not_found" }` whatever is sent, and private images stay ineligible. Answers carry
`Cache-Control: no-store`. An unknown check answers 404, a check that is not running 409
`{ "error": "check_not_running" }`. The types are in `src/core/privateAccess.ts`.

`POST /worker/checks/:id/access` takes `{}` and answers `FetchAccess`:

```json
{
  "registries": [{ "host": "ghcr.io", "label": "acme packages", "username": "alice", "secret": "<secret>" }],
  "images": [{ "imageRef": "ghcr.io/acme/shop@sha256:…", "imageDigest": "sha256:…", "tag": "1.4.2" }]
}
```

- `registries` holds the login of the registry credential that covers the check's image, for the
  registry host as the claim's image names it (for example `index.docker.io`), never a login for
  another host. `label` is the credential's label, which a refused login names in the failure.
- `images` are the check's images as a claim lists them (primary first, at most 3). The fetcher pulls
  exactly these and refuses an answer without them, so a checker that names other images cannot make
  it pull them with the check's login.
- A public image without a covering credential answers `"registries": []`.
- A finding without any pullable image left answers 409 `{ "error": "not_pullable" }`, which fails the
  preparation with `the image is no longer pullable`.

`POST /worker/checks/:id/source` takes `SourceRequest`:

```json
{ "imageRef": "ghcr.io/acme/shop", "sourceLabel": "https://github.com/acme/shop", "revisionLabel": null }
```

It is what the fetcher read from the pulled primary image (`org.opencontainers.image.source` and
`.revision`, each `null` or at most 500 characters, `imageRef` the repository, at most 300 characters).
An `imageRef` that is not the check's image answers 400 `validation` with `imageRef` `not_claimed`.

It answers `SourceAnswer`: either `{ "grant": { "repoUrls", "revision", "username", "secret" } }` or
`{ "skip": "no_repository" | "no_credential" | "not_https" | "foreign_repository" }`.

- `repoUrls` holds 1 to 3 repositories the fetcher tries in order until one clones, each
  `https://<host>/<path>.git` without credentials.
- `username` and `secret` are both `null` for an anonymous clone of a public repository. sieb does not
  probe the repository, the clone decides. An anonymous clone that fails on every URL leaves the
  workspace without `source/` with the reason `needs_credential`.
- `revision` is the revision label when it is a commit of 7 to 64 hex digits, and only for the label's
  own repository or an image without source label, else `null`. The fetcher then tries the git tag of
  the primary image's tag (`<tag>`, then `v<tag>`, never for `latest`) and else the default branch.

sieb picks the repository in this order:

1. The repository the source label names, when it is an https URL of the image's own owner. It uses the
   git credential that covers it, or else no login, and the latter only on `github.com`, `gitlab.com`
   or the git host of a stored credential with the use `git`. On any other host the skip is
   `no_credential`.
2. The repository the longest matching `repoMapping` derives from the image. It needs a git
   credential (`no_credential` otherwise).
3. The default mapping of a credential with both uses and no `repoMapping`: GitHub
   `ghcr.io/<owner>/<name>` to `github.com/<owner>/<name>`, GitLab `<registry host>/<path>` to
   `<git host>/<path>`, for a nested image name up to three paths, longest first
   (`defaultRepoMapping` in `src/core/defaultRepoMapping.ts`). It uses the covering git credential.
4. For an own image on `ghcr.io` or `registry.gitlab.com`, the same default without any credential.

The owner is the first path segment: the GitHub user or organization, the GitLab top-level group or the
Docker Hub namespace. `ghcr.io/acme/shop` takes the label `https://github.com/acme/shop` but ignores
`https://github.com/acme-platform/base`, as a base image of another owner leaves it. A label an image
sets to reach a repository of another owner never selects one. A mapping counts only for images its own
credential covers as a registry credential.

| `skip` | When |
| --- | --- |
| `not_https` | An `http`, `ssh` or scp-like label without a mapping |
| `no_credential` | No git credential covers the repository |
| `foreign_repository` | The label names a repository of another owner and no mapping covers the image |
| `no_repository` | Otherwise |

Each handed-out credential updates its `lastUsedAt` and writes one log line with the check, the
credential id and the registry host or repository, never the username or secret.

## MCP endpoint and OAuth metadata

`/mcp`, its guards (origin check, body limit, bearer token, rate limits) and the OAuth protected
resource metadata under `/.well-known/oauth-protected-resource` are described in
[Endpoint and authentication](mcp.md#endpoint-and-authentication). The `Host` rule of
[Request rules](#request-rules) applies to them, while the `/api` write rules do not.
