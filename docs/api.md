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
| `GET /api/me`                      | `{ username, authMode }`: the acting user and `header` or `oidc`, so the client knows whether a 401 means log in again                                                                                                    |
| `GET /api/findings`                | Findings in inbox order, more parameters under [Finding filters](#finding-filters); `view=inbox\|all` (default `all`), `includeResolved`, `q`, `severity`, `exposure`, `owner` (comma lists, `owner` takes free-form owner labels), `newSince`, `kev` (`true` or `1` keeps KEV listed findings only) |
| `GET /api/findings/:id`            | Finding detail: instances, decisions, history and `kev`, the CISA catalog entry, see [KEV source](#kev-source)                                                                                                            |
| `GET /api/images`, `GET /api/cves` | Open findings aggregated per image or per CVE, `includeResolved=true` adds resolved ones                                                                                                                                  |
| `GET /api/decisions`               | Decisions with their state, `state=active\|expiring\|expired\|revoked\|reopened\|fix_planned`                                                                                                                             |
| `POST /api/decisions`              | Create an image-scoped or all-scope decision, `{ vulnId, scope, imageRef?, status, justification?, reason, expiresAt? }`                                                                                                  |
| `PATCH /api/decisions/:id`         | Change status, justification, reason or expiry; `reconfirm: true` re-confirms at the current findings                                                                                                                     |
| `POST /api/decisions/:id/revoke`   | Revoke, optional `{ "comment" }`                                                                                                                                                                                          |
| `POST /api/decisions/bulk`         | `{ vulnId, imageRefs: [...] \| "all-open", status, justification?, reason, expiresAt? }`, images with a decision are skipped with reason `decided`, `expired` or `reopened`, unknown ones with `unknown_finding`          |
| `GET /api/sync`, `POST /api/sync`  | `{ run, lastFinished, running, kevFeed }`: latest run and the health of the CISA catalog; run a sync and answer the finished run                                                                                          |
| `GET /api/stats`                   | `{ current, series }`: live overview counts and their history, `range=7d\|30d\|90d` (default `30d`)                                                                                                                       |
| `GET /api/labels`                  | `{ exposure, owners, kev }`: which optional labels the open findings carry and the KEV source, see [Labels](#labels)                                                                                                      |
| `GET /api/tokens`                  | Own personal tokens, newest first, see [Tokens](#tokens)                                                                                                                                                                  |
| `POST /api/tokens`                 | Create a token, `{ name, scope, expiresAt }`, answers its secret once                                                                                                                                                     |
| `POST /api/tokens/:id/revoke`      | Revoke an own token                                                                                                                                                                                                       |
| `GET /api/mcp-info`                | `{ enabled, mcpUrl, oauth }`: whether MCP is on, the endpoint URL and whether OAuth is configured                                                                                                                         |

## Login (oidc mode)

Mounted only with `SIEB_AUTH=oidc`, outside `/api` and without a session. Setup and flow:
[deployment.md](deployment.md#oidc-mode).

| Route | Purpose |
| --- | --- |
| `GET /auth/login?return=/path` | Starts the login and redirects (302) to the identity provider; `return` must be a relative path (`/` and not `//` or `/\`), anything else returns to `/`. 503 page when the provider cannot be reached |
| `GET /auth/callback` | Redirect target of the provider: creates the session, sets the session cookie and redirects to the return path. A provider error, an unknown or expired login, a failed code exchange or a missing `preferred_username` answer a 400 page, a missing required group 403, an unreachable provider 503, each with a link to `/auth/login` |
| `POST /auth/logout` | Same rules as `/api` writes (`Content-Type: application/json`, same origin). Deletes the session, clears the cookie and answers `{ redirect }`: the provider's end-session URL with `id_token_hint` and `post_logout_redirect_uri` = public URL, or the public URL when the provider has no end-session endpoint |

Without a session, page requests (GET or HEAD of a client route) redirect to
`/auth/login?return=<path and query>`, other files answer 401; the favicon, the icons and
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

`GET /metrics` (Prometheus text format, no authentication, no Host check) exposes the values below.
With `SIEB_METRICS_PORT` it is served on that port only and the main port answers 404, which is
always the case in oidc mode.

- `sieb_suppressed{vuln_id, image_ref} 1` for every open finding whose governing decision silences
  alerts. All-scope decisions expand to one series per image the CVE is currently found in, so an
  image with its own expired or re-opened decision stays unsilenced; new images are covered from
  the next sync on.
- `sieb_last_sync_timestamp_seconds`, `sieb_last_sync_success` (0/1), `sieb_findings_open`, and
  `sieb_decisions{state}` per decision state.

## Tokens

Personal tokens authenticate Claude Code on [`/mcp`](#mcp-endpoint), see
[mcp.md](mcp.md#claude-code). The routes need the acting user of the UI login (401
`{ "error": "unauthorized" }` without one), never a token, answer `Cache-Control: no-store`, and
a user only ever sees and revokes their own tokens. While `SIEB_MCP_ENABLED` is off every
`/api/tokens` request answers 404 `{ "error": "mcp_disabled" }` and stored tokens stay untouched.

A token is answered as
`{ id, name, scope, prefix, createdAt, expiresAt, lastUsedAt, revokedAt }`, never with its
owner, hash or secret. `scope` is `read` (grants `sieb:read`) or `propose` (also `sieb:propose`,
used from 0.2.0 on; the UI does not offer it yet). `prefix` is `sieb_` and the first 8 characters
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
  refused on the next request and stays in the list until the cleanup deletes revoked and
  expired tokens 90 days later.

The secret is `sieb_` and 32 random bytes in base64url; sieb stores only its sha-256 hash. Every
create and revoke writes a log line with owner, name, id and scope, never the secret.

`GET /api/mcp-info` answers `{ "enabled": boolean, "mcpUrl": string | null, "oauth": boolean }`
whether MCP is on or off: `mcpUrl` is the absolute endpoint URL (on `SIEB_PUBLIC_URL`, else on the
origin of the request), `null` while disabled, and `oauth` is true when MCP is on and OAuth is
configured. The client hides the token dialog, the hand-off button and its keys while `enabled`
is false.

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
