# Contributing

Issues and pull requests are welcome. For larger changes, open an issue first so we can agree on
the approach. Security issues go through [SECURITY.md](SECURITY.md), not the issue tracker.

## Setup

Node 26 or newer (see `.nvmrc`). The server runs `.ts` directly through Node's type stripping, only
the client has a build step.

```sh
npm install
npm run dev:mock
```

Open http://localhost:5173. Work against mock mode unless the change needs live data. Mock mode
ignores `.env.local`, so pass variables inline, for example `SIEB_MCP_ENABLED=true npm run dev:mock`
for the Claude integration (see the [quick start](README.md#quick-start)).

Never commit real cluster inventory, report dumps or database files.

### Live mode

Live mode reads your cluster through read-only `kubectl` (current context, or `SIEB_KUBE_CONTEXT`):

```sh
cp .env.example .env.local
npm run dev
```

It needs the Trivy Operator with `operator.metricsVulnIdEnabled: true` and Prometheus with a findings
recording rule, see [What you need](docs/getting-started.md#what-you-need). Live mode stays
read-only: no `kubectl` write verbs, no Secrets. The KEV listing comes from the CISA feed, which sieb
fetches itself, so it needs outbound HTTPS unless you set `SIEB_KEV_SOURCE`.

For the `oidc` mode you need an identity provider of your own, see
[Authentication](docs/deployment.md#authentication).

## Before opening a pull request

```sh
npm run lint
npm run type-check
npm run test:unit -- --run
npm run build
```

CI runs the same checks, without `--fix`. If you change the fixture generator, run
`npm run fixtures:generate` and commit the regenerated fixtures. If you change behavior a document
describes, update that document in the same pull request.

## Scripts

| Script | Purpose |
| --- | --- |
| `dev` | API server (reads `.env.local`, watch mode) and Vite dev server |
| `dev:mock` | Same with `SIEB_SOURCE=mock` and the separate database `data/sieb-mock.db`, ignores `.env.local` |
| `dev:server`, `dev:server:mock` | API server only |
| `dev:client` | Vite dev server only, `SIEB_API_URL` overrides the proxy target |
| `build` | Type check and production build of the client into `dist/` |
| `build-only` | Production build without the type check |
| `start` | API server with `NODE_ENV=production`, serves `dist/` |
| `type-check` | `vue-tsc --build` over the app, node and vitest projects |
| `test:unit` | Vitest, add `-- --run` for a single run |
| `lint` | oxlint, then ESLint, both with `--fix` |
| `lint:check` | Both linters without `--fix`, as in CI |
| `format` | oxfmt over `src/` and `scripts/` |
| `fixtures:generate` | Regenerates the deterministic mock fixtures |
| `screenshots:generate` | Regenerates the README and guide screenshots, see [Screenshots](#screenshots) |

## Layout

```text
src/
  core/      shared types and pure logic, no IO, used by server and client (#core/*)
  server/    Hono API, sync, SQLite, sources, /metrics (#server/*)
    main.ts        reads the config and starts listening
    config.ts      environment parsing, the *ConfigValues.ts files hold the value parsers (general,
                   URL, port, source, MCP OAuth, OIDC, checks, credentials)
    auth/          bearer token verification: personal token secrets and OAuth JWTs
      oidc/        UI login of SIEB_AUTH=oidc: discovery, pending logins, cookies, /auth routes, session cleanup
    http/          app factory (createApp), identity, oidc session guard, request guards, static client
                   serving, metrics and worker listener apps, routes/ per resource
    db/            SQLite open, migrations, repositories and decision commands
    sources/       FindingSource implementations (mock, kubectl, incluster) and the raw-shape mapper
    kev/           CISA KEV feed download, validation and refresh
    sync/          snapshot upsert, sync service and scheduler
    metrics/       reads the values /metrics renders
    mcp/           /mcp endpoint, its guards, OAuth metadata, server instructions, triage prompt, tools/
    checks/        Auto-check on the sieb side: queueing, claims, results, check tokens, fetcher access
    credentials/   access credentials: vault with sealed secrets, tests, throttling, write checks
    visibility/    anonymous pull probe and image access sources (public, credential, restricted)
  checker/   Auto-check worker sieb-checker and fetcher sieb-fetcher, one image (#checker/*)
    main.ts        reads the config and runs the poll loop
    config/        value parsers, secrets from files, link to the fetcher, the WebFetch host list
    api/           worker API client and claim validation
    check/         poll loop with backoff, one check run, heartbeat, workspace wipe
    workspace/     check paths, crane export through the tar filter, symlink containment, inventory
    tar/           streaming tar rewriter that drops unsafe entries before extraction
    claude/        claude -p arguments, environment, permission settings, prompt, output parsing
    inspect/       stdio MCP server with the read-only binary tools Claude gets instead of a shell
    process/       process runner with process groups, captured runs with timeout and abort
    prepare/       the checker's side of the workspace: local pull, or the fetcher's loopback endpoint
    fetcher/       fetcher process: config, loopback endpoint, sieb access client, pulls
    source/        source checkout of the fetcher: labels, git environment and steps, size cap
  client/    Vue 3 SPA (@/*)
    assets/        main.css composes tokens.css and base.css
    api/           typed fetch helpers, one module per API resource
    components/    reusable components grouped by domain
    composables/   shared composition functions
    format/        display labels and formatting helpers
    keyboard/      shortcut helpers and hints
    router/        route definitions, route names, sidebar items
    stores/        Pinia stores, see below
    toast/         toast notifications
    views/         one route-level component per view
scripts/     project scripts: fixture generator, release script, screenshot script
```

The client stores in `src/client/stores/`:

- Findings and their views: findings, finding detail, images, CVEs, decisions, labels, stats, sync.
- Review: inbox, proposals, proposal review, finding seen marks, selection, hand-off target.
- Auto-check and access: checks, credentials.
- Session: me, MCP info, filters, data version.

## Mock data

The mock fixtures are generated from `scripts/fixtures/` in the raw source shapes and go through the
same mapper as the live sources. The KEV catalog of each state is written in the shape of the CISA
feed and goes through the same feed validation. They use public image names, invented namespaces and
the fake own registry `registry.example.com/acme`. CVE ids are in the year 2099 (`CVE-2099-NNNNN`), so
no mock id collides with a real CVE, and the KEV entry of a mock CVE is described from its finding
title.

Mock mode never touches the network:

- Every sync flips between two fixture states, so you see new, resolved and re-rated findings. The
  second state's new KEV listing re-opens decisions as a live feed would.
- With `SIEB_KEV_SOURCE=cisa` the fixture catalogs of both states are stored on every start in place
  of the feed, so the finding panel shows its details and the sync status shows the catalog health.
  `prometheus` takes the listing of the fixture state, `none` works as in live mode.
- When no stats snapshot is older than a day, the first sync is followed by 30 days of deterministic
  synthetic history (one point per 2 hours, converging to the current counts). Live sources never get
  synthetic history.
- Proposals, checks and credentials are not part of the fixtures. Create them through the UI or the
  API.

## Code

- TypeScript everywhere. Only erasable syntax (no enums, no parameter properties) and explicit
  `import type`, since the server runs through type stripping.
- Imports use the aliases `#core/*`, `#server/*`, `#checker/*` and `#scripts/*` (with `.ts`
  extension) or `@/` in the client, never `../`. No barrel files.
- `src/core` stays free of IO so both sides can use it and it stays easy to test.
- One concern per file, roughly 150 lines at most. Directories are camelCase, files with a single
  component or class are PascalCase, everything else camelCase.
- Every `if`, `for` and `while` body gets braces, one statement per line (`curly: all`).
- Functions carry a JSDoc block (`@param {Type} name - Description`, explicit `@returns`). Comments
  are rare, short and English.
- oxfmt owns formatting (`npm run format`), the linters skip formatting rules. Do not run it over
  Markdown.

## Styling

- Every color, spacing step, font size, radius, shadow and z-index is a token in
  `src/client/assets/tokens.css`. Components use scoped styles that reference those tokens.
- Light and dark mode come from `prefers-color-scheme`. The theme toggle sets `data-theme` on the
  html element and overrides the same tokens.
- Interactive elements are keyboard reachable with a visible `:focus-visible` state, and motion
  respects `prefers-reduced-motion`.

## Tests

Vitest with jsdom by default. Server tests start with `// @vitest-environment node` and call the app
factory through `app.request()` instead of opening a port. Tests live in `__tests__/` next to the code
they cover.

## Running the Auto-check worker locally

Run the worker image against a sieb on your machine, for example in mock mode. Build the image, start
sieb with Auto-check on, and point both at each other:

```sh
docker build -f Dockerfile.checker -t sieb-checker:local .
openssl rand -hex 32 > worker-secret
SIEB_MCP_ENABLED=true SIEB_CHECKS_ENABLED=true \
  SIEB_PUBLIC_URL=http://host.docker.internal:3100 \
  SIEB_ALLOWED_HOSTS=host.docker.internal:3100 \
  SIEB_WORKER_PORT=3101 SIEB_WORKER_SECRET="$(cat worker-secret)" \
  npm run dev:server:mock
```

In a second terminal, start the worker:

```sh
docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /work:rw,size=8g,uid=1000,gid=1000 \
  -v "$PWD/worker-secret:/run/secrets/worker-secret:ro" \
  -v "$HOME/.config/sieb/anthropic-api-key:/run/secrets/anthropic-api-key:ro" \
  -e SIEB_WORKER_URL=http://host.docker.internal:3101 \
  -e SIEB_WORKER_SECRET_FILE=/run/secrets/worker-secret \
  -e ANTHROPIC_API_KEY_FILE=/run/secrets/anthropic-api-key \
  sieb-checker:local
```

- The MCP URL must work from inside the container. The worker hands Claude `/mcp` on
  `SIEB_PUBLIC_URL`, so `http://localhost:3100` would point at the container itself. Use an address
  the container reaches, such as `host.docker.internal`, and accept it in sieb's host guard with
  `SIEB_ALLOWED_HOSTS`. Only loopback hosts pass without it.
- On Linux add `--add-host=host.docker.internal:host-gateway` to `docker run`. sieb listens on
  `127.0.0.1` by default, which the container cannot reach: set `SIEB_HOST` to the Docker bridge
  address (often `172.17.0.1`) or `0.0.0.0`, and keep the ports closed to your network with a
  firewall. Docker Desktop on macOS and Windows needs neither.
- The worker needs GNU tar, crane, syft and the inspect binaries, so run it from the image rather than
  with `node src/checker/main.ts` on macOS.

### With the fetcher

To test private access, run the fetcher as a second container and join the checker to its network
namespace, so `127.0.0.1:3102` reaches it. A named volume with group 1000 and mode 2770 stands in for
the `fsGroup` emptyDir. Start the fetcher first:

```sh
openssl rand -hex 32 > fetcher-secret
openssl rand -hex 32 > local-secret
docker run --rm --user 0 --entrypoint sh -v sieb-shared:/shared sieb-checker:local \
  -c 'chown 0:1000 /shared && chmod 2770 /shared && touch /shared/.keep'
docker run -d --name sieb-fetcher --read-only --cap-drop ALL --security-opt no-new-privileges \
  --user 1001:1000 --tmpfs /work:rw,size=2g,uid=1001,gid=1000,mode=0700 -v sieb-shared:/shared \
  -v "$PWD/fetcher-secret:/run/secrets/fetcher-secret:ro" \
  -v "$PWD/local-secret:/run/secrets/local-secret:ro" \
  -e SIEB_WORKER_URL=http://host.docker.internal:3101 \
  -e SIEB_FETCHER_SECRET_FILE=/run/secrets/fetcher-secret \
  -e SIEB_FETCHER_LOCAL_SECRET_FILE=/run/secrets/local-secret \
  sieb-checker:local src/checker/fetcher/fetcherMain.ts
```

Then run the checker as above with these changes:

- `--network container:sieb-fetcher`, `-v sieb-shared:/shared:ro` and the local secret mounted.
- `-e SIEB_FETCHER_URL=http://127.0.0.1:3102` and `-e SIEB_FETCHER_LOCAL_SECRET_FILE=/run/secrets/local-secret`.
- Start sieb with `SIEB_FETCHER_SECRET` set to the content of `fetcher-secret` and a
  `SIEB_CREDENTIALS_KEY`, for example from `openssl rand -base64 32`.

Mounted secret files must be readable by the container's uid or group.

### Updating Claude Code in the image

`Dockerfile.checker` installs the native Claude Code binary from its npm tarball after checking the
registry's sha512 `dist.integrity`, so no install script runs. To update it, set `CLAUDE_CODE_VERSION`
and take both integrity values from the registry:

```sh
npm view @anthropic-ai/claude-code-linux-x64-musl@<version> dist.integrity
npm view @anthropic-ai/claude-code-linux-arm64-musl@<version> dist.integrity
```

Put them into `CLAUDE_CODE_INTEGRITY_AMD64` and `CLAUDE_CODE_INTEGRITY_ARM64`, then re-check the
permission settings described in
[Auto-check internals](docs/reference/auto-check-internals.md). CI runs the image once before
publishing it: it must refuse to start without `SIEB_WORKER_URL` as checker and as fetcher, print the
git and Claude Code versions and answer `tools/list` on the inspect server.

## Screenshots

The images in `.github/assets/` are generated, never edited by hand. The script builds the client
into a temporary directory, starts its own sieb in mock mode on free loopback ports with a
throwaway database and credentials key, seeds decisions, proposals, Auto-checks and credentials
through the API, MCP and the worker API, and drives a local headless Chrome over the DevTools
protocol. No real data and no secret is involved.

Every shot is written as `screenshot-<name>-light.png` and `screenshot-<name>-dark.png`, desktop
at 1440 x 900 and phone at 390 x 844. Without `--out` the files go into a new temporary
directory; pass the assets directory to replace the committed images, and `--only` for selected
shots:

```sh
npm run screenshots:generate -- --out .github/assets
npm run screenshots:generate -- --out .github/assets --only triage,proposal
```

The script needs Chrome or Chromium, and `CHROME_PATH` overrides the lookup. `--keep` keeps the
sandbox (database, server log, Chrome profile) for debugging. It leaves `data/`, `dist/` and
running dev servers alone and stops its processes when it ends.

Shots and seed live in `scripts/screenshots/`. When a change alters a view shown in the README or
a guide, regenerate the affected shots and commit them together with the change.

## Documentation

The documents live in `README.md`, `docs/` and `docs/reference/`. Guides explain and show, the
reference states contracts completely.

- Every fact has one home. Elsewhere, write one sentence and link to it.
- Open a document with one or two sentences about who it is for and what the reader can do afterwards.
- Describe how sieb behaves today. No release history, no "since", no "no longer".
- Use second person and active voice, short paragraphs, plain words.
- Exact names go in code style: variables, routes, fields, values, files, commands, metric names.
- Use `example.com` hosts, `acme` as the organization and `CVE-2099-NNNNN` ids in examples. Secrets in
  examples are placeholders in angle brackets.
- Manifests use `<version>` image tags and never a hard-coded release.
- No em dashes, no en dashes, no emojis. Write ranges as "1 to 168".
- Code blocks carry a language tag and hold commands only, output goes in a separate block.
- Sentence case headings, at most three levels. Links name their target and use the anchors of the
  headings in the target document.

## Releasing

Releases are cut from an up-to-date, clean `main` with the GitHub CLI (`gh`) logged in:

```sh
make release x.y.z "Short release notes"
make release patch NOTES=notes.md
```

The first argument is an explicit `x.y.z` or a bump keyword (`major`, `minor`, `patch`) applied to the
latest tag. The script bumps `package.json` and `package-lock.json`, commits `Release x.y.z`, pushes
`main`, pushes an annotated tag and creates the GitHub release from the tag body. Tags have no `v`
prefix.

CI builds the images on every run but publishes them to `ghcr.io/bernhardkelm/sieb` and
`ghcr.io/bernhardkelm/sieb-checker` only on pushes, after the checks pass:

| Push | Image tags |
| --- | --- |
| `main` | `edge`, `sha-<short>` |
| Tag `x.y.z` | `x.y.z`, `x.y`, `latest`, `sha-<short>`, plus `x` from 1.0.0 on |

A prerelease tag such as `x.y.z-rc.1` publishes only its full version. Pull requests build the images
without pushing them.

## License

By contributing you agree that your contributions are licensed under the
[AGPL-3.0-or-later](LICENSE).
