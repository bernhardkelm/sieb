# Contributing

Issues and pull requests are welcome. For larger changes, open an issue first so we can agree on
the approach. Security issues go through [SECURITY.md](SECURITY.md), not the issue tracker.

## Setup

Node 26 or newer (see `.nvmrc`). The server runs `.ts` directly through Node's type stripping,
only the client has a build step.

```sh
npm install
npm run dev:mock
```

Work against mock mode unless the change needs live data. Mock mode ignores `.env.local`, pass
variables inline, for example `SIEB_MCP_ENABLED=true npm run dev:mock` for the Claude
integration (see the [quick start](README.md#quick-start)). For the oidc mode you need an
identity provider of your own, see [docs/deployment.md](docs/deployment.md#oidc-mode). Never commit real cluster inventory,
report dumps or database files. Live mode stays read-only: no kubectl write verbs, no Secrets.

## Before opening a pull request

```sh
npm run lint
npm run type-check
npm run test:unit -- --run
npm run build
```

CI runs the same checks, without `--fix`. If you change the fixture generator, run
`npm run fixtures:generate` and commit the regenerated fixtures.

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

## Layout

```text
src/
  core/      shared types and pure logic, no IO, used by server and client (#core/*)
  server/    Hono API, sync, SQLite, sources, /metrics (#server/*)
    main.ts        reads the config and starts listening
    config.ts      environment parsing, configValues.ts, mcpConfigValues.ts and oidcConfigValues.ts
                   hold the value parsers
    auth/          bearer token verification: personal token secrets and OAuth JWTs
      oidc/        UI login of SIEB_AUTH=oidc: discovery, pending logins, cookies, /auth routes, session cleanup
    http/          app factory (createApp), identity, oidc session guard, static client serving,
                   metrics listener app, routes/ per resource
    db/            SQLite open, migrations, repositories and decision commands
    sources/       FindingSource implementations (mock, kubectl, incluster) and the raw-shape mapper
    kev/           CISA KEV feed download, validation and daily refresh
    sync/          snapshot upsert, sync service and scheduler
    metrics/       reads the values /metrics renders
    mcp/           /mcp endpoint, its guards, OAuth metadata, server instructions, triage prompt, tools/
  checker/   Auto-check worker sieb-checker, its own process and image (#checker/*)
    main.ts        reads the config and runs the poll loop
    config/        value parsers, secrets from files, the WebFetch host list
    api/           worker API client and claim validation
    check/         poll loop with backoff, one check run, heartbeat, workspace wipe
    workspace/     check paths, crane export through the tar filter, symlink containment, inventory
    tar/           streaming tar rewriter that drops unsafe entries before extraction
    claude/        claude -p arguments, environment, permission settings, prompt, output parsing
    inspect/       stdio MCP server with the read-only binary tools Claude gets instead of a shell
    process/       process runner with process groups, captured runs with timeout and abort
  client/    Vue 3 SPA (@/*)
    assets/        main.css composes tokens.css and base.css
    api/           typed fetch helpers, one module per API resource
    components/    reusable components grouped by domain
    composables/   shared composition functions
    format/        display labels and formatting helpers
    keyboard/      shortcut helpers and hints
    router/        route definitions, route names, sidebar items
    stores/        Pinia stores: findings, images, CVEs, decisions, filters, user, MCP info
    toast/         toast notifications
    views/         one route-level component per view
scripts/     project scripts such as the fixture generator
```

The mock fixtures are generated from `scripts/fixtures/` in the raw source shapes and go through the
same mapper as the live sources; the KEV catalog of each state is written in the shape of the CISA
feed and goes through the same feed validation. They use public image names, invented namespaces and the fake own
registry `registry.example.com/acme`. CVE ids are in the year 2099 (`CVE-2099-NNNNN`), so no mock id
collides with a real CVE, and the KEV entry of a mock CVE is described from its finding title.

## Code

- TypeScript everywhere. Only erasable syntax (no enums, no parameter properties) and explicit
  `import type`, since the server runs through type stripping.
- Imports use the aliases `#core/*`, `#server/*`, `#checker/*` and `#scripts/*` (with `.ts` extension) or `@/` in
  the client, never `../`. No barrel files.
- `src/core` stays free of IO so both sides can use it and it stays easy to test.
- One concern per file, roughly 150 lines at most. Directories are camelCase, files with a single
  component or class are PascalCase, everything else camelCase.
- Every `if`, `for` and `while` body gets braces, one statement per line (`curly: all`).
- Functions carry a JSDoc block (`@param {Type} name - Description`, explicit `@returns`).
  Comments are rare, short and English.
- oxfmt owns formatting (`npm run format`), the linters skip formatting rules.

## Styling

- Every colour, spacing step, font size, radius, shadow and z-index is a token in
  `src/client/assets/tokens.css`. Components use scoped styles that reference those tokens.
- Light and dark mode come from `prefers-color-scheme`; the theme toggle sets `data-theme` on the
  html element and overrides the same tokens.
- Interactive elements are keyboard reachable with a visible `:focus-visible` state, and motion
  respects `prefers-reduced-motion`.

## Tests

Vitest with jsdom by default. Server tests start with `// @vitest-environment node` and call the
app factory through `app.request()` instead of opening a port. Tests live in `__tests__/` next to
the code they cover.

## Releasing

Releases are cut from an up-to-date, clean `main` with the GitHub CLI (`gh`) logged in:

```sh
make release 0.2.0 "Short release notes"
make release patch NOTES=notes.md
```

The first argument is an explicit `x.y.z` or a bump keyword (`major`, `minor`, `patch`) applied to
the latest tag. The script bumps `package.json` and `package-lock.json`, commits `Release x.y.z`,
pushes `main`, pushes an annotated tag and creates the GitHub release from the tag body. Tags have
no `v` prefix.

CI builds the image on every run but publishes it to `ghcr.io/bernhardkelm/sieb` only on pushes,
after the checks pass:

| Push | Image tags |
| --- | --- |
| `main` | `edge`, `sha-<short>` |
| Tag `x.y.z` | `x.y.z`, `x.y`, `latest`, `sha-<short>`, plus `x` from 1.0.0 on |

A prerelease tag such as `0.3.0-rc.1` publishes only its full version. Pull requests build the
image without pushing it.

## License

By contributing you agree that your contributions are licensed under the
[AGPL-3.0-or-later](LICENSE).
