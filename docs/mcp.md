# Claude integration

sieb serves a [Model Context Protocol](https://modelcontextprotocol.io) endpoint at `/mcp`, so
Claude can read and query sieb's data while you investigate findings: "does CVE-X affect us",
"which public images still have critical openssl findings", "what is open in namespace Y". Claude
Code connects with a personal token you create in the UI, claude.ai through a custom connector
that signs in with authentik (OAuth). In 0.1.0 Claude only reads: it investigates and reports back
with links into sieb, you decide in sieb.

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
2. Create a token: a name such as the machine it is for, access **Read**, and an expiry of 30
   days, 90 days (default) or 1 year. Every token expires, after at most a year. "Read and propose" arrives with decision proposals.
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
2. Add scope mappings named `sieb:read` and, for the next release, `sieb:propose`, and select them
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
- Which scopes claude.ai requests, and whether authentik grants the advertised `sieb:propose`
  before the next release needs it.

## Tools

Every tool only reads sieb's own database and carries `readOnlyHint`. Results hold sieb links,
always absolute: on `SIEB_PUBLIC_URL`, else on the origin the request reached sieb at.

| Tool | Answers |
| --- | --- |
| `get_overview` | "How are we doing?": open, inbox, KEV, public, by severity, not affected, accepted, fix planned, re-opened, the last successful sync, the KEV source and catalog health, and who is connected |
| `check_vulnerability` | "Does CVE-X affect us?": every scanned image and workload carrying it with package, installed and fixed version, exposure, owner and governing decision, KEV details, images it was found in before; when absent, says so with the time of the last sync |
| `search_findings` | Questions across findings, with the [finding filters](api.md#finding-filters) plus `groupBy` (`none`, `cve`, `image`, `namespace`, `package`) for counts per group, `limit` (at most 50, default 20) and `offset`, and the `total` |
| `get_finding` | One finding by `findingId`, or by `vulnId` and `imageRef`: instances per workload and container, every decision covering it with history, KEV details |
| `get_image` | One image: owner, exposure, risk counts, workloads and its open findings |
| `list_decisions` | Earlier verdicts on the same CVE, package or image, filtered by state or status, newest first |

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

## Triage prompt and hand-off

The MCP prompt `triage_finding` takes a `findingId` or a `vulnId` and walks Claude through an
investigation: facts from sieb and earlier decisions, presence, reachability, exposure, evidence,
fix path, review date, unknowns and confidence, ending in a report with a verdict (`not_affected`
with an OpenVEX justification, `accepted`, `fix_planned` or `needs_patch`) or "undecided". In
Claude Code it appears as `/mcp__sieb__triage_finding`.

The finding panel has a hand-off split button that passes the open finding to Claude: the CVE,
image, packages with installed and fixed versions, the sieb link and what to investigate. The main
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

## What Claude can and cannot do

In 0.1.0 Claude can read findings, images, decisions, KEV details and the overview, and run the
triage prompt. It cannot create, change, revoke or accept decisions, run a sync or manage tokens:
no tool for any of that exists. Claude reports its verdict back to you and you decide in sieb.

0.2.0 adds decision proposals: a token with "Read and propose" access, or an OAuth token with
`sieb:propose`, lets Claude file a structured proposal that you accept, edit or reject in a
proposal inbox. Proposals never mute an alert until you accept them.

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
  Revoked and expired tokens stop working at once and stay listed for 90 days, then the periodic
  cleanup deletes them.
- OAuth tokens must be signed with RS256 or ES256 by a key of the issuer's key set, with the exact
  issuer, the client id as the only audience (a string, or an array holding only it), an `exp`
  that has not passed on sieb's clock (the MCP SDK refuses a token at `exp`, without tolerance),
  and a `typ` header, when present, of `at+jwt` or `JWT`. An ID token of the UI login fails the
  exact audience, and a token without `sieb:read` in its `scope` claim gets 403. `preferred_username` must be 1 to 256 characters without
  control or invisible format characters. With `SIEB_OAUTH_REQUIRED_GROUP` the `groups` claim
  must contain the group, else 403.
- Advisory text (titles, scanner links, CISA KEV descriptions and notes) and the user-written
  decision reasons and history values reach Claude under an `untrusted` key, and the server
  instructions and the triage prompt tell Claude to treat it as data, never as instructions.

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
