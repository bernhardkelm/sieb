# Claude integration

sieb serves a [Model Context Protocol](https://modelcontextprotocol.io) endpoint at `/mcp`, so
Claude can read and query sieb's data while you investigate findings: "does CVE-X affect us",
"which public images still have critical openssl findings", "what is open in namespace Y". Claude
Code connects with a personal token you create in the UI, claude.ai through a custom connector
that signs in with authentik (OAuth). Claude reads, and with `sieb:propose` files its verdict as a
proposal that you accept or reject in sieb; nothing changes before you decide.

The integration is off by default. While it is off, sieb serves no `/mcp` and no OAuth metadata,
the token routes answer 404 `mcp_disabled`, and the UI hides the token dialog, the hand-off button
and its keys.

## Enabling it

| Variable | Needed for | Meaning |
| --- | --- | --- |
| `SIEB_MCP_ENABLED=true` | both clients | Serves `/mcp` and the personal token routes |
| `SIEB_PUBLIC_URL` | claude.ai, recommended for both | Origin sieb is reached at, for example `https://sieb.example.com`, https in production |
| `SIEB_OAUTH_ISSUER` | claude.ai | Issuer of the authentik provider, must equal the `iss` claim exactly |
| `SIEB_OAUTH_CLIENT_ID` | claude.ai | Client id of the authentik provider, must equal the `aud` claim |
| `SIEB_OAUTH_REQUIRED_GROUP` | optional | Group an OAuth caller must have in the `groups` claim |
| `SIEB_OAUTH_JWKS_URL` | optional | Key set URL, discovered from the issuer when unset |
| `SIEB_OAUTH_CLIENT_LABEL` | optional | Client name of OAuth callers in logs and tool results, default `claude.ai` |
| `SIEB_MCP_ALLOWED_ORIGINS` | optional | Browser origins `/mcp` accepts besides its own host, for browser-based MCP clients |

Without `SIEB_OAUTH_ISSUER` and `SIEB_OAUTH_CLIENT_ID`, `/mcp` accepts personal tokens only. The
two come together, and OAuth refuses to start without `SIEB_PUBLIC_URL`. The OAuth variables are
ignored while MCP is off. `SIEB_PUBLIC_URL` also makes every link in the tool results and the
endpoint URL shown in the UI independent of the request; without it sieb uses the origin each
request reached it at (`Host` and `X-Forwarded-Proto`). See the
[configuration table](../README.md#configuration) for defaults and
[deployment.md](deployment.md) for exposing sieb.

## Claude Code

1. In sieb, open the user menu (your username in the top bar) and choose **API tokens…**.
2. Create a token: a name such as the machine it is for, access **Read**, or **Read and propose**
   so Claude can file its verdicts as [proposals](#proposals), and an expiry of 30 days, 90 days
   (default) or 1 year. Every token expires, after at most a year.
3. sieb shows the secret once, together with the command to register sieb in Claude Code. The
   dialog stays open until you click **Done**, Esc and clicks outside do not close it. Copy the
   command and run it in a terminal:

   ```sh
   claude mcp add --transport http --scope user sieb https://sieb.example.com/mcp \
     --header "Authorization: Bearer sieb_…"
   ```

4. Check the connection with `claude mcp list`, or `/mcp` inside Claude Code.

To try this locally against the fixtures, see the [quick start](../README.md#quick-start).

Claude Code stores the header, and with it the token, in plain text in `~/.claude.json`. Keep the
`--scope user` of the command: user scope keeps the token out of every repository. Never put the
token into a project `.mcp.json` and never commit one that contains it. A token acts as you, so
treat it like a password, and revoke it in the dialog when a machine is lost or the token leaked.

## claude.ai

> Needs verification: the authentik and claude.ai parts below follow the code sieb runs and the
> MCP authorization spec, but have not yet been checked end to end against a real authentik and claude.ai. The
> points to confirm are listed at the end of this section.

claude.ai connects from Anthropic's servers and signs you in through authentik. sieb is the OAuth
resource server: it publishes [protected resource metadata](api.md#oauth-protected-resource-metadata)
that names authentik as the authorization server and verifies authentik's access tokens on every
request. sieb does not support Dynamic Client Registration, the client is registered in authentik
beforehand.

### authentik

1. Create an OAuth2/OpenID provider, for example named `sieb-mcp`:
   - client type confidential, note the client id and the client secret,
   - PKCE with `S256`,
   - redirect URIs `https://claude.ai/api/mcp/auth_callback` and
     `https://claude.com/api/mcp/auth_callback`,
   - an RSA certificate as signing key: sieb accepts only RS256 and ES256 signed tokens, a provider
     without signing key signs with the client secret (HS256), which sieb refuses,
   - a short access token validity, refresh tokens for longer sessions.
2. Add scope mappings named `sieb:read` and, for proposals, `sieb:propose`, and select them
   on the provider. sieb reads the granted scopes from the space separated `scope` claim of the
   access token; a token without `sieb:read` gets 403 `insufficient_scope`.
3. Make sure the access token carries the claims sieb needs:
   - `preferred_username`: the sieb user the caller acts as, the same username as in the UI, so
     decisions and logs match. A token without it is refused.
   - `groups`: only when `SIEB_OAUTH_REQUIRED_GROUP` is set, a list that must contain that group.
   - `iss` equal to `SIEB_OAUTH_ISSUER`, `aud` equal to `SIEB_OAUTH_CLIENT_ID`, and `exp`.
4. Create an application for the provider and bind a policy that admits only your group, the same
   group you set as `SIEB_OAUTH_REQUIRED_GROUP`.
5. Configure sieb with `SIEB_OAUTH_ISSUER` (the provider's issuer, usually
   `https://authentik.example.com/application/o/<application slug>/` with its trailing slash), the
   client id as `SIEB_OAUTH_CLIENT_ID` and the group as `SIEB_OAUTH_REQUIRED_GROUP`. sieb finds the
   key set through `<issuer>.well-known/openid-configuration`, or uses `SIEB_OAUTH_JWKS_URL`.

### Connector

Add a custom connector in claude.ai with the MCP URL, `https://sieb.example.com/mcp`, and the
client id and client secret of the authentik provider. Once OAuth is configured, the token dialog
also shows that URL with a copy button after you create a token. claude.ai then sends you through
the authentik sign-in. Where claude.ai asks for the client id and secret is not verified yet, see
below.

### To verify

- claude.ai accepts a pre-registered client id and secret for a custom connector, and where its
  connector form asks for them.
- The redirect URIs claude.ai uses match the two listed above.
- claude.ai finds authentik from sieb's metadata and discovers authentik's endpoints through its
  OpenID configuration.
- The access token authentik issues is a JWT signed with RS256 and carries `aud`, `scope`
  (including `sieb:read`), `preferred_username` and `groups`, also when claude.ai requests only the
  scopes sieb advertises. If the profile claims are missing, add them to the `sieb:read` scope
  mapping.
- Which scopes claude.ai requests, and whether authentik grants the advertised `sieb:propose`,
  which `propose_decision` needs.

## Tools

Every tool works on sieb's own database only (`openWorldHint: false`). All but `propose_decision`
only read and carry `readOnlyHint`. Results hold sieb links, always absolute: on `SIEB_PUBLIC_URL`,
else on the origin the request reached sieb at.

| Tool | Answers |
| --- | --- |
| `get_overview` | "How are we doing?": open, inbox, KEV, public, by severity, not affected, accepted, fix planned, re-opened, the Inbox counts of the connected user (`inboxItems`: proposals, re-opened, expiring, new KEV), the last successful sync, the KEV source and catalog health, and who is connected (`connectedAs`: actor, via, client, `scopes` and `canPropose`) |
| `check_vulnerability` | "Does CVE-X affect us?": every scanned image and workload carrying it with package, installed and fixed version, exposure, owner and governing decision, KEV details, images it was found in before; when absent, says so with the time of the last sync |
| `search_findings` | Questions across findings, with the [finding filters](api.md#finding-filters) plus `groupBy` (`none`, `cve`, `image`, `namespace`, `package`) for counts per group, `limit` (at most 50, default 20) and `offset`, and the `total` |
| `get_finding` | One finding by `findingId`, or by `vulnId` and `imageRef`: instances per workload and container, every decision covering it with history, KEV details |
| `get_image` | One image: owner, exposure, risk counts, workloads and its open findings |
| `list_decisions` | Earlier verdicts on the same CVE, package or image, filtered by state or status, newest first |
| `list_my_proposals` | The proposals filed for the connected sieb user, newest first, with state, resolution, outdated flag, reject reason (under `untrusted`) and review URL; `state` (default `all`), `vulnId`, `limit`, `offset` |
| `propose_decision` | Only with `sieb:propose`: files a structured decision proposal, see [Proposals](#proposals) |

Example questions:

- "We have a new KEV listed CVE-2024-3094, does it affect us?" uses `check_vulnerability`.
- "Which public images still have critical openssl findings?" uses `search_findings` with
  `packages`, `severity` and `exposure`.
- "What is open in namespace monitoring?" uses `search_findings` with `namespaces` and the inbox
  view, or `groupBy: "image"` for an overview.
- "What became KEV listed this week?" uses `search_findings` with `kevAddedSince`, which needs the
  `cisa` KEV source.
- "How did we decide on curl before?" uses `list_decisions`.
- "How are we doing?" uses `get_overview`.

sieb only knows what Trivy scanned. A vulnerability missing from sieb means "not seen in any
scanned image as of the last successful sync", never "safe", and the server instructions tell
Claude to say so with the sync time.

`check_vulnerability`, `get_finding`, `get_image` and `search_findings` rows carry `sourceAccess`
per image: `private` only for own images (owner `self`), `public` for images of a registry in
`SIEB_PUBLIC_REGISTRIES` with another owner, `unknown` for every other registry and for a ref
without one. The server instructions tell Claude that for `private` images only advisory-level
checks are possible unless it runs inside the repository that builds the image (the triage prompt
points to the hand-off `claude` command), and that an `unknown` image may or may not be
inspectable, so it tries to pull it.

`get_finding` and `check_vulnerability` name the configured KEV source as `kevSource` (`cisa`,
`prometheus` or `none`). Only `cisa` fills `kevCatalog` with the CISA dates and text. For a KEV
flagged vulnerability under another source, `kevCatalog` is `null` and `kevNote` explains why:
"KEV flag comes from the configured Prometheus KEV query; CISA catalog details are only available
with the cisa KEV source." The server instructions tell Claude this is no contradiction.

Every MCP handshake (`initialize`, or `server/discover` of the 2026-07-28 revision) writes one log
line with the actor, how it authenticated, the client and the granted sieb scopes, never a token,
for example `[sieb] MCP initialize by alice via oauth (claude.ai), scopes sieb:read`. It shows
which scopes a connector really got.

## Proposals

With a token of "Read and propose" access or an OAuth token with `sieb:propose`, Claude sees
`propose_decision` and files what it found as a structured proposal. Nothing changes in sieb until
a human accepts it: no decision, no muted alert, no change to `/metrics`, the stats or the triage
list. The tool is annotated as neither read-only nor destructive.

The target is a `findingId` on its own, or a `vulnId` with `imageRefs` (tag or digest ignored,
matched case-insensitively) or `all: true` for every image; `findingId` together with `vulnId`,
`imageRefs` or `all` is refused. Each target image needs an open finding. The
claims are structured: `verdict` (`not_affected` with an OpenVEX `justification`, `accepted`,
`fix_planned`, or `needs_patch`, a fix planned with a concrete `fix.change`), `summary`,
`confidence`, `presence`, `reachability`, `exposure`, `evidence` (`check`, `method`, `result`),
`fix`, `review` (date and why, the date becomes the proposed expiry), `unknowns`, `references`
(http(s) only), `agent` and `evidenceBasis`. `evidenceBasis` is required and must be honest:
`advisory` (advisory and sieb data), `upstream_source`, `image`, `own_source` (the repository
that builds the image) or `runtime`. For a private image Claude cannot inspect, the basis is
`advisory` and the confidence low or medium, and a `not_affected` resting on `advisory` alone is
weak evidence.

The answer is `{ proposalId, url, replacedProposalId?, note }`, `url` being
`<base>/inbox/proposals/<id>`, where the proposal is reviewed; Claude ends its answer with it. A
new proposal from the same user for the same target replaces the open one (`replacedProposalId`).
A user holds at most 200 open proposals, and `propose_decision` takes at most 30 valid calls per
hour and sieb user, across all of the user's tokens and OAuth clients. Every proposal, accept and
reject writes a server log line.

The reviewer accepts as proposed, edits status, justification, reason and expiry before
accepting, or rejects with a reason (see [api.md](api.md#proposals)). `list_my_proposals` returns
the outcome, so Claude sees the reject reason and does not file the same proposal again.

Every review is opened deliberately. After an accept or reject the review panel closes and focus
returns to the next Inbox row; Enter or a click opens the next review. j and k only move the
cursor: they close an open review and return focus to the list. Cmd+Enter (Ctrl+Enter)
accepts only on a fresh key press, never on a key repeat, and only once the proposal has been on
screen for 700 ms and the reviewer interacted with it since it appeared: a pointer press inside
the review or a key that is no part of the chord, such as an arrow key scrolling it. Enter, the
modifier keys, keys pressed with a modifier held and the keys of a refused Cmd+Enter never count.
The accept sends the decisions of the first load of the review, each with its `updatedAt`; when a
later reload finds another decision or a newer version of the same one, the accept waits until
the reviewer chooses Review again.

## Triage prompt and hand-off

The MCP prompt `triage_finding` takes a `findingId` or a `vulnId` and walks Claude through an
investigation: facts from sieb and earlier decisions, source access, presence, reachability,
exposure, evidence and its basis, fix path, review date, unknowns and confidence. With
`sieb:propose` it ends in `propose_decision` (after checking `list_my_proposals`), filed without
asking first, since a proposal changes nothing until a human accepts it. The detail goes into the
proposal fields, the chat answer stays in the reply format below. A vulnerability that is present
but practically unreachable, with an upgrade as the fix, is `needs_patch` or `fix_planned`, not
`not_affected`. Without `sieb:propose` the prompt ends in the same short reply, which says that no
proposal was filed because the connection is read-only. In Claude Code it appears as
`/mcp__sieb__triage_finding`.

### Reply format

The server instructions and the triage prompt ask Claude for a fixed reply. The server
instructions stay below 4,096 characters per variant, since Claude Code cuts them off there. For
one finding, at most five lines and nothing else unless asked:

```text
**CVE-2025-1234 · ghcr.io/example/app** → needs_patch · confidence high
Why: libexample 1.2.0 is installed and its vulnerable parser handles every request body.
Checked: advisory, image · Not checked: runtime
Fix: upgrade libexample to 1.2.1 in the base image
Proposal: https://sieb.example.com/inbox/proposals/42
```

The first line always contains the word "confidence" and carries the OpenVEX justification in
parentheses for `not_affected`. Why is one sentence of at most 25 words, Checked and Not checked
are comma-separated `evidenceBasis` keywords, Fix is one line or "none needed". Without
`sieb:propose` the last line is copied verbatim: "No proposal filed: this connection is read-only
(token or connector needs sieb:propose)." Several triaged findings become a table with the
columns Finding, Verdict, Conf. and Proposal, one row per finding, followed by one summary line
such as "3 proposals filed, 1 skipped (no verdict): …".

A plain question that is no triage, "does CVE-X affect us" across many images included, gets the
answer in the first line, at most three bullets with counts and names, then the sieb link, with no
table or verdict block; Claude offers a proposal only when a decision is actually pending. A mixed
question ("find X, then triage one") gets the answer in the first line, at most three bullets,
then the five-line block of the triaged finding. When a filtered search returns nothing, the first
line says so before Claude widens it and names the widened filter. "public" in a question means
exposure `public` unless the user says registry or source, which is `sourceAccess`. For a
third-party image sieb's tools and the public advisory are enough; when a tool outside sieb is
refused, Claude does not retry with another one and names the check under Not checked.

When a connection lacks `sieb:propose`, `propose_decision` is not in Claude's tool list, and the
server instructions tell Claude to say so plainly when asked to triage: the connection only reads,
and filing a proposal needs a "Read and propose" token or reconnecting the connector with
`sieb:propose`. `get_overview` shows the granted scopes under `connectedAs`.

The finding panel has a hand-off split button that passes the open finding to Claude: the CVE,
image, packages with installed and fixed versions, the sieb link and a short instruction to call
`get_finding`, check presence, reachability and exposure, file the verdict with
`propose_decision` without asking when it is available, and reply in the five-line reply format
(or end with the read-only line without it). The prompt is one line of roughly 800 to 1,100
characters, far below the link limits. The main
button runs your default action, the chevron menu lists the rest:

| Target | Link | Needs |
| --- | --- | --- |
| Claude Code (desktop) | `claude://code/new?q=` | the Claude desktop app |
| Claude chat (desktop) | `claude://claude.ai/new?q=` | the desktop app and the sieb connector |
| Claude Code in terminal | `claude-cli://open?q=` | `claude` run interactively once, which registers the handler |
| VS Code | `vscode://anthropic.claude-code/open?prompt=` | the Claude Code VS Code extension |

The links only prefill the prompt, you review and send it yourself. They carry nothing but the
prompt, no token, folder or repository, so the sieb MCP server or connector must already be set up
in that client. A browser cannot tell whether a handler is installed, so after opening sieb shows a
toast to copy the prompt instead. A prompt too long for a link (14,000 encoded characters for the
desktop app, 5,000 for the terminal and VS Code) is copied instead of cut.

The menu also copies the prompt, and for your own images (owner `self`) a ready
`claude '<prompt>'` command meant to be run inside the repository that builds the image. Under
**Default action** you pick what the main button does; the choice is stored in the browser and
defaults to Claude Code desktop, or to copying on touch devices. With the panel open, `Shift+H`
runs the default action, `h` copies the prompt and `y` the command.

The deep links and the command only help once Claude can reach sieb, so they stay disabled, with
a note on how to connect, until you hold a live API token (your name in the top bar, **API
tokens**) or sieb saw an MCP request of yours through the OAuth connector within the last 30
days. Copying the prompt always works.

## What Claude can and cannot do

Claude can read findings, images, decisions, KEV details and the overview, run the triage prompt
and, with `sieb:propose`, file and list its proposals. It cannot create, change, revoke or accept
decisions, run a sync or manage tokens: no tool for any of that exists. A proposal only takes
effect when you accept it in sieb.

## Security model

- `/mcp` authenticates only through `Authorization: Bearer`. It never reads the forward-auth user
  header (`SIEB_USER_HEADER`), a client-sent copy has no effect there. The caller acts as the token
  owner, or as `preferred_username` of an OAuth token.
- Bearer tokens are never accepted under `/api`. The UI and its API keep their own login, and the
  token routes need that login, never a token. See [deployment.md](deployment.md) for how sieb is
  exposed and which paths need which login.
- `/mcp` keeps the `Host` check of every route, refuses a present `Origin` that is neither its own
  host nor in `SIEB_MCP_ALLOWED_ORIGINS` (clients outside a browser send none), limits bodies to
  128 KiB, needs the `sieb:read` scope and allows 120 requests per minute per token or OAuth user.
  See [api.md](api.md#mcp-endpoint) for the answers.
- Personal tokens are `sieb_` plus 32 random bytes. sieb stores only their sha-256 hash and a
  short prefix to recognise them, shows the secret once with `Cache-Control: no-store`, never logs
  it, and compares hashes in constant time. Each user holds at most 20 live tokens and only sees
  and revokes their own; every create and revoke is logged with owner, name, id and scope.
  Revoked and expired tokens stop working at once; their owner can delete them from the token
  list (one by one or with "Clear inactive"), otherwise the periodic cleanup deletes them after 90
  days. Proposals keep their attribution after a token is deleted, and token ids are never reused.
- OAuth tokens must be signed with RS256 or ES256 by a key of the issuer's key set, with the exact
  issuer, the client id as the only audience (a string, or an array holding only it), an `exp`
  that has not passed on sieb's clock (the MCP SDK refuses a token at `exp`, without tolerance),
  and a `typ` header, when present, of `at+jwt` or `JWT`. An ID token of the UI login fails the
  exact audience, and a token without `sieb:read` in its `scope` claim gets 403. `preferred_username` must be 1 to 256 characters without
  control or invisible format characters. With `SIEB_OAUTH_REQUIRED_GROUP` the `groups` claim
  must contain the group, else 403.
- Advisory text (titles, scanner links, CISA KEV descriptions and notes), the user-written
  decision reasons and history values, and proposal summaries and reject reasons reach Claude
  under an `untrusted` key, and the server
  instructions and the triage prompt tell Claude to treat it as data, never as instructions.
- Proposal content is stored and served as plain text with length caps, control, bidirectional
  formatting and invisible characters removed, and references limited to http(s) URLs without
  credentials; the review shows each reference normalized, a lookalike host in punycode. No MCP tool accepts, decides, syncs or manages tokens.

### Offboarding

`/mcp` never uses the UI login, so removing someone from authentik does not stop their personal
tokens by itself. In oidc mode, a login refused because the user lacks
`SIEB_OIDC_REQUIRED_GROUP` deletes all their sessions and revokes all their live tokens (logged),
but only once they try to log in. Tokens without an expiry, from before expiry became mandatory,
no longer work at all. Revoke them in the token dialog before the account goes, or revoke every live token of a
user in the database:

```sh
kubectl -n sieb exec deploy/sieb -- node -e "
  const { DatabaseSync } = require('node:sqlite')
  const db = new DatabaseSync('/data/sieb.db')
  console.log(db.prepare(\"UPDATE api_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), revoked_by = 'admin' WHERE owner = ? AND revoked_at IS NULL\").run(process.argv[1]))
" alice
```

OAuth access ends with the authentik account or group membership: authentik issues no new tokens,
and an access token already issued stays valid until it expires, which is why its validity should
be short.
