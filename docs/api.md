# HTTP API

JSON under `/api`. The acting user comes from the header named by `SIEB_USER_HEADER` (default
`X-authentik-username`), outside production `SIEB_DEV_USER` stands in; without either, reads work
and writes answer 401. Invalid input answers 400
`{ "error": "validation", "errors": [{ "field", "code" }] }`, unknown ids 404, conflicts 409
`{ "error": "conflict" | "revoked", "decisionId" }`. An `Authorization` header is ignored under
`/api`: bearer tokens only authenticate [`/mcp`](#mcp-endpoint). With `SIEB_AUTH=oidc` the acting
user comes from the session of sieb's own login instead, the header is ignored and every `/api`
route except `/api/health` answers 401 `{ "error": "unauthorized" }` without a session, reads
included, see [Login](#login-oidc-mode).

## Request rules

Checked before identity:

- A request target with a dot segment (`.` or `..`, literal or percent-encoded in any case, also
  with backslashes) answers 400 `{ "error": "invalid_path" }`, so no path can be normalised into
  another route behind a path-based Ingress rule.
- Every response carries `X-Content-Type-Options: nosniff` and `Content-Security-Policy:
  frame-ancestors 'none'`.
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

| Route                              | Purpose                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                  | `{ status, source }`, no Host check                                                                                                                                                                                       |
| `GET /api/me`                      | `{ username, authMode, version, sourceCodeUrl }`: the acting user, `header` or `oidc` so the client knows whether a 401 means log in again, and the running version with the link to its source code (`SIEB_SOURCE_URL`, otherwise the upstream tag) |
| `GET /api/findings`                | Findings in triage order, more parameters under [Finding filters](#finding-filters); `view=inbox\|all` (default `all`), `includeResolved`, `q`, `severity`, `exposure`, `owner` (comma lists, `owner` takes free-form owner labels), `newSince`, `kev` (`true` or `1` keeps KEV listed findings only) |
| `GET /api/findings/:id`            | Finding detail: instances with where Trivy found the package, see [Found in](#found-in), decisions, history, `kev`, the CISA catalog entry, see [KEV source](#kev-source), and `sourceAccess` of the image, see [Source access](#source-access)                                                                                                            |
| `GET /api/images`, `GET /api/cves` | Open findings aggregated per image or per CVE, `includeResolved=true` adds resolved ones                                                                                                                                  |
| `GET /api/decisions`               | Decisions with their state, `state=active\|expiring\|expired\|revoked\|reopened\|fix_planned`                                                                                                                             |
| `POST /api/decisions`              | Create an image-scoped or all-scope decision, `{ vulnId, scope, imageRef?, status, justification?, reason, expiresAt? }`                                                                                                  |
| `PATCH /api/decisions/:id`         | Change status, justification, reason or expiry; `reconfirm: true` re-confirms at the current findings                                                                                                                     |
| `POST /api/decisions/:id/revoke`   | Revoke, optional `{ "comment" }`                                                                                                                                                                                          |
| `POST /api/decisions/bulk`         | `{ vulnId, imageRefs: [...] \| "all-open", status, justification?, reason, expiresAt? }`, images with a decision are skipped with reason `decided`, `expired` or `reopened`, unknown ones with `unknown_finding`          |
| `GET /api/sync`, `POST /api/sync`  | `{ run, lastFinished, running, kevFeed }`: latest run and the health of the CISA catalog; run a sync and answer the finished run                                                                                          |
| `GET /api/stats`                   | `{ current, series }`: live overview counts and their history, `range=7d\|30d\|90d` (default `30d`)                                                                                                                       |
| `GET /api/labels`                  | `{ exposure, owners, kev }`: which optional labels the open findings carry and the KEV source, see [Labels](#labels)                                                                                                      |
| `GET /api/inbox`                   | `{ items, counts }`: what waits for the acting user, see [Inbox](#inbox)                                                                                                                                                                                                                             |
| `POST /api/inbox/seen`             | Mark expiring and KEV items as seen, `{ keys: [...] }`, answers `{ counts, ignored }`                                                                                                                                                                                                                |
| `GET /api/proposals`               | Decision proposals filed through MCP, `state=open\|accepted\|rejected\|superseded\|all` (default `open`), `vulnId`, see [Proposals](#proposals) |
| `GET /api/proposals/:id`           | One proposal with sieb's facts per image, the current decisions and what accepting writes |
| `POST /api/proposals/:id/accept`   | Accept, `{ expectedDecisionIds, edits? }`, writes the decisions in one transaction |
| `POST /api/proposals/:id/reject`   | Reject, `{ reason }` |
| `GET /api/tokens`                  | Own personal tokens, newest first, see [Tokens](#tokens)                                                                                                                                                                  |
| `POST /api/tokens`                 | Create a token, `{ name, scope, expiresAt }`, answers its secret once                                                                                                                                                     |
| `POST /api/tokens/:id/revoke`      | Revoke an own token                                                                                                                                                                                                       |
| `DELETE /api/tokens/:id`           | Delete an own revoked or expired token, answers 204                                                                                                                                                                       |
| `POST /api/tokens/cleanup`         | Delete all own revoked and expired tokens, answers `{ deleted }`                                                                                                                                                          |
| `GET /api/mcp-info`                | `{ enabled, mcpUrl, oauth, claude }`: whether MCP is on, the endpoint URL, whether OAuth is configured and whether Claude reaches sieb for the acting user                                                               |

## Login (oidc mode)

Mounted only with `SIEB_AUTH=oidc`, outside `/api` and without a session. Setup and flow:
[deployment.md](deployment.md#oidc-mode).

| Route | Purpose |
| --- | --- |
| `GET /auth/signin?return=/path` | Sign-in page, a static HTML page with a "Sign in with SSO" button to `/auth/login` with the same return rule; `signedOut=1` adds "You are signed out of sieb.". Clears the signed-out cookie; with a valid session it redirects (302) to the return path |
| `GET /auth/login?return=/path` | Starts the login and redirects (302) to the identity provider; `return` must be a relative path (`/` and not `//` or `/\`), anything else returns to `/`. 503 page when the provider cannot be reached |
| `GET /auth/callback` | Redirect target of the provider: creates the session, sets the session cookie and redirects to the return path. A provider error, an unknown or expired login, a failed code exchange or a missing `preferred_username` answer a 400 page, a missing required group 403, an unreachable provider 503, each with a link to `/auth/login` |
| `POST /auth/logout` | Same rules as `/api` writes (`Content-Type: application/json`, same origin). Deletes the session, clears the cookie, sets the signed-out cookie for 5 minutes and answers `{ redirect }`: the provider's end-session URL with `id_token_hint` and `post_logout_redirect_uri` = public URL, or the public URL when the provider has no end-session endpoint |

Without a session, page requests (GET or HEAD of a client route) redirect to
`/auth/signin?return=<path and query>`, with `&signedOut=1` while the signed-out cookie is
present, other files answer 401; the favicon, the icons and
`site.webmanifest` stay public, as do `/api/health`, `/mcp` and `/.well-known/oauth-protected-resource*`
while MCP is enabled.

## Finding filters

`GET /api/findings` also takes these optional parameters; the MCP tool `search_findings` offers
the same filters:

- `vulnIds`, `packages`, `images`, `namespaces`, `workloads`: comma lists of name patterns, each
  at most 256 characters. A pattern matches exactly, or by prefix when it ends with `*`, both
  case-insensitive. A tag or digest of an `images` pattern is ignored. A `workloads` pattern
  matches `namespace/kind/name`, `namespace/name` or the resource name. Several patterns of one
  parameter match any of them.
- `minScore`: 0 to 10, keeps findings whose score is at least that; findings without a score
  never match.
- `decisionState`: comma list of `undecided`, `active`, `not_affected`, `accepted`,
  `fix_planned`, `expired`, `reopened`, the state of the governing decision; `active` covers
  active `not_affected` and `accepted` decisions.
- `kevAddedSince`: a date or timestamp, keeps KEV listed findings whose CISA `date_added` is on
  or after that day (UTC). Only the `cisa` KEV source knows the date, with other sources the
  parameter is ignored.
- `fixable`: `true`/`1` keeps findings with a known fixed version in a current instance,
  `false`/`0` those without. Every finding carries the boolean `fixable`.

An invalid value answers 400 `invalid` for its field.

`search_findings` names two of them differently, `text` for `q` and `firstSeenSince` for
`newSince`, takes the lists as JSON arrays of at most 50 entries and `text` up to 200 characters,
and adds `groupBy`, `limit` and `offset`, see [mcp.md](mcp.md#tools).

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
`owner` label); only `self` has a meaning, own images first. Triage order and the `maxExposure` of
`GET /api/images` and `GET /api/cves` rank exposure public > gated > unknown > internal; owners
sort `self` first, the others alphabetically, `null` last. An `owner` filter never matches `null`;
the `exposure` filter takes `unknown` next to the three labels to match `null`. `owner` filter entries are trimmed and must be at most 64 characters, an entry
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
`allScopeDecision` is the non-revoked all-scope decision of the CVE or `null`, and
`allScopeEffective` its state as in `DecisionView.effective`, a re-open no sync has latched yet
included.

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
- `none`: no finding is KEV listed, Triage ranks by exposure, severity and score only and the
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
its own decision is revoked, gets its baseline at first sight; under an all-scope decision this
also writes an `updated` event by `sieb` with the payload `{ coveredImage }`. A decision re-opens
as soon as any governed open finding ranks above its own baseline or is KEV listed while its
baseline was not; the whole decision re-opens then. The sync that sees this latches it
(`reopenedAt`, `reopenTrigger`, one `reopened` event), so the decision stays re-opened when the
severity or KEV listing falls back. Between the change and that sync the re-open is pending:
`effective` already says `reopened`, with `reopenedAt` `null`. Only `PATCH` with `reconfirm: true`
clears the latch and records new baselines at the current findings, which also settles a pending
re-open, so the next sync finds nothing to re-open; edits of reason, status or expiry without it
keep the decision re-opened. Expired and re-opened events are written once per transition.

## Metrics

`GET /metrics` (Prometheus text format, no authentication, no Host check) exposes the values below.
With `SIEB_METRICS_PORT` it is served on that port only and the main port answers 404, which is
always the case in oidc mode.

- `sieb_suppressed{vuln_id, image_ref} 1` for every open finding whose governing decision silences
  alerts. All-scope decisions expand to one series per image the CVE is currently found in, so an
  image with its own expired or re-opened decision stays unsilenced; new images are covered from
  the next sync on.
- `sieb_last_sync_timestamp_seconds`, `sieb_last_sync_success` (0/1), `sieb_findings_open`, and
  `sieb_decisions{state}` per decision state.

## Inbox

The Inbox collects what waits for the acting user. Both routes need an identity (401
`{ "error": "unauthorized" }` without one, reads included, since seen marks are per user) and
answer `Cache-Control: no-store`.

`GET /api/inbox` answers `{ items, counts }`, `counts` being
`{ proposal, reopened, expiring, kev, total }` over the listed items. Every item carries
`key` (stable identity), `kind`, `at` (the time it sorts by), `vulnId`, `imageRef` (`null` for a
decision on every image or a proposal on several), `severity` and `kev` (highest severity and any
KEV listing of the open findings it covers), `title` (advisory title of a covered finding, may be
`null`), `url` (absolute link into sieb on `SIEB_PUBLIC_URL`, else on the origin of the request)
and `refs`:

| Kind       | Key                                  | `at`         | In the Inbox while                                                                                | Extra fields                                                                                                                         |
| ---------- | ------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `proposal` | `proposal:<id>`                      | `createdAt`  | the proposal is open                                                                              | `refs: { proposalId }`, `imageRefs` (targets, `null` for every image), `verdict`, `confidence`, `imageCount` (covered open findings) |
| `reopened` | `reopened:<decisionId>:<reopenedAt>` | `reopenedAt` | the decision is re-opened, until re-confirmed (`reconfirm: true`, also within an edit) or revoked | `refs: { decisionId, findingId }`, `decisionStatus`, `reopenReason`                                                                  |
| `expiring` | `expiring:<decisionId>:<expiresAt>`  | `expiresAt`  | the decision is active and expires within 14 days, until extended or marked seen                  | `refs: { decisionId, findingId }`, `decisionStatus`                                                                                  |
| `kev`      | `kev:<findingId>`                    | `kevSince`   | the open finding became KEV listed within the last 14 days, also when decided, until marked seen  | `refs: { findingId, decisionId }`, `decisionStatus` (governing decision or `null`)                                                   |

A re-open the current data shows but no sync has latched yet uses `pending` instead of
`<reopenedAt>` and the current time as `at`. An extension gives an expiring decision a new key, so
it shows again when it comes within 14 days of its new expiry. Proposal items link to
`/inbox/proposals/<id>`; the other kinds link to `/triage?finding=<id>`, the covered finding the
re-open names or else the most pressing one (`refs.findingId`), and a decision without open
findings links to the decisions view. Items are ordered as events first, newest first
(proposals, re-opened decisions and new KEV listings interleaved by `at`), then expiring decisions
soonest first, ties by `key`. MCP tools link findings to `/triage?finding=<id>` as well; the
client still opens a 0.1.0 link of the form `/inbox?finding=<id>` on Triage when a page loads
with it. Within the client, the Inbox markers of finding rows and the finding panel link the
other kinds to `/inbox?item=<key>`, which starts the Inbox cursor on that item.

`POST /api/inbox/seen` takes `{ "keys": [...] }`, at most 200 keys (`required`, `invalid`,
`too_many` on `keys`), and marks them seen for the acting user; a bad key is reported as
`keys.<index>` with `not_seeable` for `proposal` and `reopened` keys, which leave by being handled,
and `invalid` for anything else that is not a well-formed `expiring` or `kev` key. Only keys
listed in the acting user's Inbox right now are marked; the others, such as an item that left the
Inbox or was marked before, are not stored and come back in `ignored`. Marking again changes
nothing visible, the answer is `{ counts, ignored }` after the marks. At most 5000 marks are kept
per user, more drop the oldest. A KEV mark holds only for the
current listing: a CVE that leaves the catalog and returns shows again. Marks older than 30 days
are deleted by the periodic cleanup, after both 14-day windows have passed.

`findings.kev_since` is written by the sync: the sync time when a finding is first seen KEV listed
or its flag turns on, cleared when the flag turns off. Findings KEV listed before 0.2.0 keep
`null` and do not show as new.

## Proposals

Claude files decision proposals through the MCP tool `propose_decision` (scope `sieb:propose`, see
[mcp.md](mcp.md#proposals)); a human accepts, edits or rejects them here. A proposal never
changes a decision, `/metrics`, the stats or the triage list until it is accepted. The routes sit
under `/api` with its identity, write and body rules; accept and reject write a log line with the
proposal id, the acting user and the target, never the free text.

A proposal (`Proposal` in `src/core/proposal.ts`) carries:

- Target: `vulnId`, `scope` (`image` or `all`) and `imageRefs` (sorted, `null` for scope all).
  Every target image needs an open finding of the CVE, scope all at least one.
- Claims: `verdict` (`not_affected`, `accepted`, `fix_planned`, `needs_patch`), `justification`
  (OpenVEX, required with `not_affected` only), `summary`, `confidence` (`low`, `medium`,
  `high`), `presence`, `reachability`, `exposure`, `evidence` (`[{ check, method, result }]`),
  `fix` (`{ fixedVersion, change, effort }`, `change` required for `needs_patch`), `review`
  (`{ date, why }`, `date` follows the `expiresAt` rules), `unknowns`, `references` (http(s) URLs
  only) and `evidenceBasis`, at least one of `advisory`, `upstream_source`, `image`,
  `own_source`, `runtime`. Free text loses control, bidirectional formatting and invisible
  characters (zero-width characters, the Arabic letter mark, soft hyphens) and is capped (summary
  1000 characters, presence, reachability and exposure 4000, at most 30 evidence entries, 20
  unknowns, 20 references). Treat all of it as untrusted plain text.
- Snapshots: `sourceAccess` (`[{ imageRef, access }]` when proposed) and `basisDecisions`
  (`[{ imageRef, decisionId, updatedAt }]`, the decisions governing the targets when proposed,
  `imageRef` `null` for the all-scope target).
- Proposer: `proposedBy` (the sieb user of the token or OAuth login), `proposedVia` (`token` or
  `oauth`), `clientLabel`, `agent` and `createdAt`. The id of the proposer's token is stored for
  the server log but never answered.
- Outcome: `state` (`open`, `accepted`, `rejected`, `superseded`), `resolution` (`accepted`,
  `accepted_edited`, `rejected`, `replaced`, `other_accepted`, `finding_resolved`),
  `resolutionNote` (the reject reason), `decisionIds`, `resolvedAt` and `resolvedBy` (`sieb` for
  a sync).

Rules: a user holds one open proposal per target (CVE, scope and image set), a new one replaces the
old (`replaced`), and at most 200 open proposals. Accepting supersedes the other open proposals
whose target overlaps (`other_accepted`). A sync supersedes a proposal once none of its images has
an open finding left (`finding_resolved`).

`GET /api/proposals` answers `ProposalListItem[]`, newest first:
`{ proposal, outdated, severity, kev, imageCount }`. `outdated` is true for an open proposal when
a decision governing one of its targets was created, changed or revoked since it was filed;
`severity` and `kev` cover the open target findings, for scope all every open image.

`GET /api/proposals/:id` answers `ProposalDetail`, the list item plus:

- `images`: sieb's own facts per image (the targets, for scope all every image with an open
  finding): `{ imageRef, findingId, open, severity, score, kev, exposure, owner, sourceAccess,
  versions: [{ package, installedVersion, fixedVersion }], workloads, decision }`, `decision` being
  the `DecisionView` governing the image now.
- `allScopeDecision`: the current all-scope decision of the CVE or `null`.
- `currentDecisionIds`: `[{ imageRef, decisionId, updatedAt }]`, the governing decision per
  target now and the version of it (`decisionId` and `updatedAt` both `null` for none); send it
  back unchanged as `expectedDecisionIds`. The client sends the entries of its first load of the
  review, not those of a later reload.
- `decisionValues`: `{ status, justification, reason, expiresAt }` that accepting without edits
  writes: `needs_patch` becomes `fix_planned`, the reason is generated from verdict, summary, the
  first three evidence checks, the fix and the confidence (at most 2000 characters), and the
  expiry is the review date while it lies ahead, else the default of the status.
- `kevCatalog`: the CISA catalog entry, `null` for other KEV sources.

`POST /api/proposals/:id/accept` takes
`{ "expectedDecisionIds": [{ "imageRef", "decisionId", "updatedAt" }], "edits"?: { "status", "justification", "reason", "expiresAt" } }`.
Edits follow the decision rules (`edits.<field>` with `invalid`, `not_allowed`, `too_long`,
`in_past`, `too_far`); any other field, such as `scope` or `imageRefs`, is `not_allowed`. In one
transaction it writes per target image the image-scoped decision, updating and re-confirming an
existing one, or for scope all the all-scope decision, and answers
`{ proposal, decisions, supersededIds }` with the written decisions as `DecisionView`. The
`created` or `updated` events of those decisions carry
`provenance: { proposalId, proposedBy, clientLabel, editedFields }`.

`POST /api/proposals/:id/reject` takes `{ "reason" }`, 1 to 2000 characters (`required`,
`too_long`), and answers `{ proposal }`. The proposer reads the reason back through
`list_my_proposals`.

Errors: 404 `{ "error": "not_found" }` for an unknown proposal; 409
`{ "error": "proposal_conflict", "currentDecisionIds" }` when a governing decision is no longer the
expected one or was edited since (same `decisionId`, other `updatedAt`), nothing is written; 409 `{ "error": "proposal_closed", "state" }` for a proposal that
is no longer open; 400 `expectedDecisionIds` `required` or `invalid` (an entry without `updatedAt`, with an
unparsable one, or with an `updatedAt` but no `decisionId` is `invalid`).

### Source access

`sourceAccess` tells whether the source behind an image can be checked from outside: `private` only
for own images (owner `self`), `public` for images of a registry in `SIEB_PUBLIC_REGISTRIES` with
another owner, `unknown` for every other registry and for a ref without one, since such an image
may or may not be pullable. An image without a registry
host counts as Docker Hub. It appears in the finding detail, the proposal detail and the MCP
finding rows.

## Found in

Every instance of the finding detail carries where Trivy found its package, read from the
vulnerability entry of the VulnerabilityReport:

| Field          | Content                                                                            |
| -------------- | ---------------------------------------------------------------------------------- |
| `locations`    | `[{ target, pkgPath }]`, distinct, at most 20; empty when the report names neither |
| `packageType`  | Trivy `packageType`, such as `gobinary`, `npm`, `python-pkg`, `debian` or `alpine` |
| `packageClass` | Trivy `class`, `os-pkgs` or `lang-pkgs`                                            |
| `purl`         | `packagePURL`, else `pkgIdentifier.PURL` or `purl`, only with the `pkg:` scheme    |

`target` is the scanned file or the OS release: a Go binary (`usr/local/bin/traefik`), a lockfile
(`app/package-lock.json`), `Python` or `Node.js` for installed packages, or the image with its OS
release for OS packages. `pkgPath` is the package file inside the image when Trivy reports one.
Every field is optional and `null` (or `[]`) when missing, when it is not a plain string (control
or format characters) or when it exceeds its cap: 1024 characters for paths, 512 for the PURL, 64
for type and class. trivy-operator writes target, class, packageType and pkgPath only when
`trivy.additionalVulnerabilityReportFields` includes `Target`, `Class`, `PackageType` and
`PackagePath`.

One instance is one package version in one container, so when Trivy lists the same package in two
binaries of a container, the instance keeps both locations; different workloads of an image keep
their own. Type, class and PURL come from the first entry that has them. The panel shows the
merged paths per package version under "Found in", and the MCP tools `get_finding` and
`check_vulnerability` answer them as `foundIn` per image.

Schema step 12 adds the nullable columns `finding_instances.locations` (a JSON array, checked to be
one), `package_type`, `package_class` and `purl`. Existing rows stay `null` until the next sync,
which writes them for every instance it sees; each sync overwrites them with what the latest
report says.

## Tokens

Personal tokens authenticate `claude -p`, CI and scripts on [`/mcp`](#mcp-endpoint), see
[mcp.md](mcp.md#personal-tokens). The routes need the acting user of the UI login (401
`{ "error": "unauthorized" }` without one), never a token, answer `Cache-Control: no-store`, and
a user only ever sees, revokes and deletes their own tokens. While `SIEB_MCP_ENABLED` is off every
`/api/tokens` request answers 404 `{ "error": "mcp_disabled" }` and stored tokens stay untouched.

A token is answered as
`{ id, name, scope, prefix, createdAt, expiresAt, lastUsedAt, revokedAt }`, never with its
owner, hash or secret. `scope` is `read` (grants `sieb:read`) or `propose` (also `sieb:propose`,
which offers `propose_decision`). `prefix` is `sieb_` and the first 8 characters
of the secret. `lastUsedAt` is `null` until first use and written at most once a minute;
`expiresAt` is `null` only for tokens created before expiry became mandatory, which are no
longer accepted.

- `GET /api/tokens` lists every token of the user, revoked and expired ones included, newest
  first.
- `POST /api/tokens` takes `{ "name", "scope", "expiresAt" }` and answers 201
  `{ "token", "secret" }`, the only time the secret leaves the server. `name` is trimmed, 1 to 64
  characters without control characters (`required`, `too_long`, `invalid`); `scope` is `read` or
  `propose` (`required`, `invalid`); `expiresAt` is required and never `null` (`required`), follows
  the `expiresAt` rules of [Request rules](#request-rules) and lies at most 365 days ahead
  (`too_far`; a date-only value ends that day, so one day of slack applies). A user
  holds at most 20 live tokens (neither revoked nor expired), one more answers 409
  `{ "error": "too_many_tokens" }`.
- `POST /api/tokens/:id/revoke` revokes the token and answers it; revoking it again keeps the
  first revocation. An unknown id or a token of another user answers 404. A revoked token is
  refused on the next request and stays in the list until its owner deletes it or the cleanup
  deletes revoked and expired tokens 90 days later.
- `DELETE /api/tokens/:id` deletes a revoked or expired token of the user and answers 204 without
  a body. A live token answers 409 `{ "error": "token_live" }`, revoke it first; an unknown id or
  a token of another user answers 404. Like every write it needs `Content-Type: application/json`.
- `POST /api/tokens/cleanup` takes `{}`, deletes every revoked and expired token of the user in
  one transaction and answers `{ "deleted": n }`; live tokens stay.

Proposals filed with a deleted token keep `proposedBy`, `proposedVia` and `clientLabel`, and the
stored token id stays as it was: it has no foreign key, and a new token always gets an id above
every token id and every token id a proposal stores, so it never takes over a deleted one.

The secret is `sieb_` and 32 random bytes in base64url; sieb stores only its sha-256 hash. Every
create, revoke and delete writes a log line with owner, name, id and scope, never the secret;
`POST /api/tokens/cleanup` writes one line per deleted token.

`GET /api/mcp-info` answers `{ "enabled": boolean, "mcpUrl": string | null, "oauth": boolean, "claude": … }`
whether MCP is on or off: `mcpUrl` is the absolute endpoint URL (on `SIEB_PUBLIC_URL`, else on the
origin of the request), `null` while disabled, and `oauth` is true when MCP is on and OAuth is
configured. The client hides the token dialog, the hand-off button and its keys while `enabled`
is false. The answer carries `Cache-Control: no-store`.

`claude` is `null` while MCP is off or the request has no user, else
`{ "connected": boolean, "activeTokens": number, "oauthLastSeenAt": string | null }` for the acting
user: `activeTokens` counts the personal tokens that are neither revoked nor expired,
`oauthLastSeenAt` is the last MCP request authenticated through OAuth, of any age, and `connected`
is true with at least one active token or an OAuth request within the last 30 days. The client
disables the deep-link hand-off and the `claude` command while `connected` is false.

Schema step 11 adds the table `mcp_connections` (`username`, `via` of `token` or `oauth`,
`last_seen_at`), one row per user and kind. Every authenticated `/mcp` request past the rate limit
updates it, at most once per user and kind every five minutes through an in-memory throttle; a
failed write is logged and does not fail the request.

## MCP endpoint

With `SIEB_MCP_ENABLED=true`, `/mcp` serves the [Model Context Protocol](https://modelcontextprotocol.io)
over streamable HTTP, stateless and with JSON answers instead of event streams. It sits outside
`/api` and has its own checks, in this order:

1. `Host` as for every route, else 403 `{ "error": "forbidden_host" }`.
2. A present `Origin` must name the requested host or an entry of `SIEB_MCP_ALLOWED_ORIGINS`, else
   403 `{ "error": "forbidden_origin" }`; `null` and malformed origins are refused. Clients outside
   a browser send no `Origin` and pass.
3. Bodies are limited to 128 KiB, else 413 `{ "error": "payload_too_large" }`.
4. `Authorization: Bearer <token>` with a personal token (`sieb_…`) or, with OAuth configured, an
   access token of the issuer, see [mcp.md](mcp.md#security-model) for the checks. The user
   header of the UI login is never read here. A missing, unknown, revoked, expired or invalid token
   answers 401, a token without the `sieb:read` scope, or an OAuth caller outside
   `SIEB_OAUTH_REQUIRED_GROUP`, 403 `insufficient_scope`. Both carry the OAuth error body
   `{ "error", "error_description" }` and a challenge such as
   `WWW-Authenticate: Bearer error="invalid_token", error_description="…", scope="sieb:read", resource_metadata="https://sieb.example.com/.well-known/oauth-protected-resource/mcp"`,
   with `resource_metadata` only when OAuth is configured. When the issuer's keys cannot be
   fetched the answer is 500 `server_error`.
5. At most 120 requests per minute per personal token or OAuth user, in fixed one-minute windows
   kept in memory, else 429 `{ "error": "rate_limited" }` with `Retry-After` in seconds.

On top, `propose_decision` accepts at most 30 valid calls per hour and sieb user, shared by all of
the user's tokens and OAuth clients, beyond that the tool answers an error result and files
nothing.

Only `POST` carries MCP messages; an authenticated `GET` or `DELETE`, the session operations of
the transport, answers 405 with `Allow: POST`. While MCP is off `/mcp` answers 404 `{ "error": "not_found" }`.

## OAuth protected resource metadata

With MCP on and OAuth configured (`SIEB_OAUTH_ISSUER`, `SIEB_OAUTH_CLIENT_ID`, which need
`SIEB_PUBLIC_URL`), `GET /.well-known/oauth-protected-resource` and the path-aware
`GET /.well-known/oauth-protected-resource/mcp` answer the same
[RFC 9728](https://www.rfc-editor.org/rfc/rfc9728) document, without authentication, with
`Access-Control-Allow-Origin: *` and `Cache-Control: public, max-age=3600`:

```json
{
  "resource": "https://sieb.example.com/mcp",
  "authorization_servers": ["https://authentik.example.com/application/o/sieb-mcp/"],
  "scopes_supported": ["sieb:read", "sieb:propose"],
  "bearer_methods_supported": ["header"],
  "resource_name": "sieb"
}
```

`resource` is `/mcp` on `SIEB_PUBLIC_URL`, `authorization_servers` holds `SIEB_OAUTH_ISSUER`.
Without OAuth both paths answer 404.
