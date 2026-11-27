# Auto-check

Auto-check lets you queue findings for an unattended investigation by Claude. A separate worker,
`sieb-checker`, takes one check at a time, prepares a throwaway workspace with the files of the
image, runs headless Claude Code against it and lets Claude file its verdict as a normal
[proposal](mcp.md#proposals) through sieb's MCP endpoint. Nothing changes in sieb until a person
accepts or rejects the proposal. The routes, states and timeouts are described in
[api.md](api.md#auto-check).

## What it does and what it does not

- **Public images, and private ones through the fetcher.** Without credentials the worker pulls
  public images anonymously (see [source access](api.md#source-access)). With
  [private access](#private-access) set up and the worker running as
  [two containers](#two-containers), the fetcher container pulls private images with the
  credentials sieb stores and checks out the source of your own images; Claude never sees a
  credential.
- **One check at a time.** sieb runs at most one check, the worker claims the oldest queued one.
  Run a single worker replica.
- **No cluster access.** The worker needs no service account and never talks to the Kubernetes
  API. It reaches sieb's worker port, the registries, the git hosts, Anthropic and the web.
- **The scanned images, by digest.** A finding groups every tag of one image repository, and a
  decision covers all of them. The worker pulls each distinct digest of the finding's open
  instances, at most three, most recently seen first; the prompt names the open tags beyond
  that, and Claude lists them as unknowns. When sieb knows no digest at all, the worker resolves
  the tag of the most recently seen instance with `crane digest`, pulls that one image, and tells
  Claude and the Checks page that the content may differ from what was scanned.
- **What Claude sees:** the investigation prompt sieb builds from the finding, per pulled image
  the flattened filesystem for one platform, the image config (environment, entrypoint, labels,
  history) and a package inventory from syft, the [inspect tools](#inspect-tools) for binaries,
  archives and JSON, sieb's MCP tools limited to the check's finding (see
  [Auto-check tokens](mcp.md#auto-check-tokens)), WebFetch on an
  [allow list](#web-access) of advisory and source hosts, and WebSearch. Claude has no shell.
  With the fetcher, also `source/`: the repository of the primary image at the commit its
  `org.opencontainers.image.revision` label names, or at the default branch, without `.git`.
- **What Claude does not see:** no registry or git credential, no running container, no
  cluster, no images of other findings and no files of the worker. Without `source/` the prompt
  names the reason (no repository label or mapping, no credential, clone failed, size cap, no
  fetcher), Claude lists the source under unknowns and must not claim `own_source` as evidence
  basis. A verdict that depends on how the image is deployed names that under *Not checked*.

## Enabling it in sieb

| Variable | Default | Meaning |
| --- | --- | --- |
| `SIEB_CHECKS_ENABLED` | `false` | `true` or `1` turns on Auto-check, needs `SIEB_MCP_ENABLED` and `SIEB_PUBLIC_URL` |
| `SIEB_WORKER_PORT` | empty | Port of the listener that serves only the worker routes, required when on |
| `SIEB_WORKER_SECRET` | empty | Bearer secret the worker sends, at least 32 characters without whitespace, required when on; sieb has no `_FILE` variant |
| `SIEB_CHECK_TIMEOUT_SECONDS` | `1200` | Time limit of one check in seconds, 1 to 14400; the worker stops Claude when it passes, sieb fails the check one minute later |
| `SIEB_CHECK_MAX_TURNS` | `60` | Turn limit the worker hands to Claude Code, 1 to 500 |

See the [configuration table](../README.md#configuration) for the full list. Generate the secret
with, for example, `openssl rand -hex 32` and give the same value to sieb and the worker; in
Kubernetes, pass it to sieb as an environment variable from a Secret (`secretKeyRef`). Add the
worker port to sieb's Service, for example as port `worker` with `targetPort` 3101, and see
[Deployment](deployment.md#auto-check) for the Service and NetworkPolicy changes.

## Using it

- **Queueing.** The Auto-check button in the finding panel, or `Shift+C`, queues the panel's
  finding; in Triage the selection bar and `Shift+C` queue the checked rows, sent in requests of
  at most 100 findings. The button names the reason when it cannot queue, for example a private
  image, a resolved finding or an offline worker. The queue holds at most 500 open checks: a
  selection whose checks do not all fit is not queued at all, the button names the room left.
  A toast reports the queued findings and the skipped ones with their reason.
- **Checks page.** The Checks page (key `6`, in the navigation while Auto-check is on, with the
  open checks as a badge) shows the running check with its phase, the queue in claim order, and
  the 50 most recent ended checks with requester, duration, the checked images (tag and short
  digest), the model that ran, turns, usage, cost, the error of a failed check and Claude's reply
  as plain text. Any signed-in user can cancel a queued or running check.
- **Retry.** A failed or cancelled check that is the latest of its finding has a Retry action, on
  the Checks page and in the finding panel. It queues the finding again with the same rules as a
  new check, so it is blocked while the worker is offline.
- **Finish toasts.** When one of your own checks ends while sieb is open, a toast says so: done
  with a Review action that opens the proposal in the Inbox, done without a proposal, or failed
  with its reason. Cancelled checks, checks of other users and checks that ended before the page
  loaded stay silent.
- **Could not determine.** When the image does not settle the question, Claude files the verdict
  `inconclusive` with what it would need to decide (`missing`, see
  [Verdict inconclusive](mcp.md#verdict-inconclusive)) instead of a guess. The review lists it as
  "Could not determine" and offers Decide myself, Re-check, which queues a new check of the
  finding, and Dismiss; an inconclusive proposal never becomes a decision on its own.
- **Usage.** The Usage section of the Checks page sums the ended checks of all users over the
  last 7 and 30 days: checks, input, output and cache tokens, cost and average duration. The cost
  is what Claude Code reports, see [Claude credential](#claude-credential); checks whose worker
  reported no usage are counted but add no tokens.

## Private access

With `SIEB_CREDENTIALS_KEY` set on sieb and `SIEB_FETCHER_SECRET` on sieb and the worker, signed-in
users store read credentials for GitHub, GitLab (gitlab.com or self-hosted) and Docker Hub on the
**Access** page, in the user menu next to API tokens. Any image a registry credential covers can
then be checked, and for your own images Auto-check also clones the source at the image's
revision. Without the key the page explains what to set; without the fetcher secret it warns that
the stored credentials are not used yet.

During an Auto-check, Claude reads the private images and the source code these credentials
reach, and what it reads is sent to Anthropic. Only add credentials for code your organisation
allows to share with Claude.

- **List.** Each credential shows its provider, label, the hosts and path prefix it covers, its
  uses, the username, who added it and when, when it was last used and the last test. Test tries
  the credential on the images and repositories it covers and shows the counts and the failures.
  Edit changes label, prefix, mapping and username, and replaces the token only when a new one is
  typed. Delete asks first; revoke the token at the provider too.
- **Tokens are write-only.** The token field is never prefilled, and sieb never shows a stored
  token again.
- **Path prefix.** The path within the hosts a credential covers, matched in whole segments:
  `your-group/` covers `registry.gitlab.com/your-group/*` and `gitlab.com/your-group/*`, empty
  covers the whole host.
- **Repository mapping.** Optional, for images without a usable
  `org.opencontainers.image.source` label: the registry prefix of the image is swapped for the
  repository prefix to find the repository to clone, for example `ghcr.io/your-org/` to
  `github.com/your-org/` maps `ghcr.io/your-org/shop` to `github.com/your-org/shop`. Both
  prefixes stay within the credential's own hosts and path prefix, so a mapping applies only to
  images that credential covers.
- **Source label.** A label counts only when its repository belongs to the image's owner (the
  first path segment, `your-org` above), so a label inherited from a base image of another
  owner, or one an image sets to reach other code, never picks the repository.
- **Changing hosts.** Changing the provider or adding a host needs the token again, so a stored
  token never goes to a host it was not entered for. Test runs at most every 30 seconds per
  credential and only to public addresses.
- **Finding panel.** Per image, the fact *Auto-check access* says *Public*, *Via* the covering
  credential, or *No access* with a link to the Access page, and the Auto-check button names the
  missing credential as its block reason.
- **Checks page.** A recent check that cloned source shows it as *Source*, the repository with
  the short revision, or the default branch when the image named none.

Tokens with the least access, as the Access page explains them per provider:

| Provider | Token | Access |
| --- | --- | --- |
| GitHub, source code | Fine-grained personal access token | Only select repositories; Repository permissions Contents: Read-only (Metadata read-only is added by GitHub) |
| GitHub, packages (`ghcr.io`) | Personal access token (classic), fine-grained tokens do not support GitHub Packages | Only the `read:packages` scope |
| GitLab | Group deploy token, or a project deploy token | Scopes `read_registry` and `read_repository`; enter the username GitLab shows, one credential covers registry and git; for a self-hosted GitLab set both hosts |
| Docker Hub | Personal access token | Access permissions Read-only, plus your Docker Hub username |

For GitHub, add two credentials for the least access: the fine-grained token with the use Git and
the classic token with the use Registry.

## Monitoring

sieb's `/metrics` exports the open checks per state, the ended checks per status, the run time
of done and failed checks and, while Auto-check is on, whether the worker is online, see
[Metrics](api.md#metrics). [prometheus-rules.md](prometheus-rules.md#auto-check-alerts) has
example alerts for an offline worker and a queue that does not move.

## Claude credential

The worker runs the unmodified Claude Code binary with one of two credentials, never both. sieb
never stores either of them: you provision it for the worker as a Kubernetes Secret, and only the
worker reads it. Anthropic's rules for the two are in
[Authentication and credential use](https://code.claude.com/docs/en/legal-and-compliance.md#authentication-and-credential-use).

- **API key, recommended for any shared or team deployment.** Create a key in the
  [Claude Console](https://platform.claude.com/) and store it as `ANTHROPIC_API_KEY`. Checks are
  billed per use to the key's organization; the cost a check shows in sieb is what Claude Code
  reports for the run.
- **Subscription token, only for your own, individual use of your own deployment.** On a machine
  with a browser, run `claude setup-token`. It prints a one-year OAuth token of your Pro, Max,
  Team or Enterprise plan that can only make model requests; store it as
  `CLAUDE_CODE_OAUTH_TOKEN`. Checks count against your plan's usage limits, the cost a check shows
  is Claude Code's API-equivalent estimate. Do not run a worker with your subscription for other
  people's checks.

The worker refuses to start with neither or both, and with `ANTHROPIC_AUTH_TOKEN`, which Claude
Code would prefer over both.

## Two containers

The worker image has two commands. The default one, the **checker**, claims checks and runs
Claude. The **fetcher** (`src/checker/fetcher/fetcherMain.ts`) prepares the workspace. Run both
as containers of one pod:

```text
pod sieb-checker
  fetcher  uid 1001, gid 1000   SIEB_FETCHER_SECRET, registry and git logins of the running check
     |  POST /prepare, /release on 127.0.0.1:3102, bearer SIEB_FETCHER_LOCAL_SECRET
  checker  uid 1000, gid 1000   Claude credential, SIEB_WORKER_SECRET, sieb token of the check
  volumes  shared   fetcher read-write, checker read-only: images/ and source/ of the check
           fetcher  /work of the fetcher: HOME, TMPDIR, DOCKER_CONFIG, syft output
           checker  /work of the checker: Claude's HOME and TMPDIR, MCP config, settings
```

1. The checker claims a check and posts its images and the time left to the fetcher's loopback
   endpoint, which only the pod reaches.
2. The fetcher asks sieb for the check's registry logins (`POST /worker/checks/<id>/access`,
   bearer `SIEB_FETCHER_SECRET`), writes them into a `DOCKER_CONFIG` directory (mode 700, file
   600) in its private volume, resolves and pulls the images into
   `<shared>/check-<id>/images/` as in single-container mode and deletes the docker config before
   syft runs. It pulls the images sieb's answer lists, the claim's images, and ignores the ones
   the checker named; an answer without them fails the preparation, and so does a finding
   without any pullable image left (`the image is no longer pullable`).
3. It reads the `org.opencontainers.image.source` and `org.opencontainers.image.revision` labels
   of the primary image and asks sieb for the source (`POST /worker/checks/<id>/source`). For a
   grant it runs `git init`, a depth-1 `git fetch` of the commit over https, the default branch
   when the commit is unknown or not a full commit id, and `git checkout`, into
   `<shared>/check-<id>/source/`; then it deletes `.git` and the ignore files, contains the
   symlinks like those of an image, and checks the size cap. The clone gets at most five minutes.
4. The checker reads the answer, checks that it can read the workspace and runs Claude in
   `<shared>/check-<id>/` as before. The result carries `source` (repository URL, commit or
   `null` for the default branch, and whether the label named the repository). At the end the
   checker posts `/release`, and the fetcher wipes the check from both of its volumes; it also
   wipes leftovers at its start and before every preparation.

A cancelled or timed-out check closes the request, which stops the fetcher's tools. Without
`SIEB_FETCHER_URL` the checker works as in 0.5: it pulls public images itself and checks out no
source, and a pull that the registry refuses fails with "the image needs a registry credential,
which only the fetcher container uses (SIEB_FETCHER_URL)". The checker waits at its start until
the fetcher answers, and refuses to start when it holds `SIEB_FETCHER_SECRET`.

The worker mode does not change what sieb queues. With private access on in sieb
(`SIEB_CREDENTIALS_KEY` and `SIEB_FETCHER_SECRET` set) but the worker in single-container mode,
checks of private images are queued and claimed and then fail with that message. Run the
two-container layout whenever private access is on.

### Self-hosted GitLab or registry

- **Private CA.** crane and git run with a stripped environment, so `SSL_CERT_FILE`,
  `SSL_CERT_DIR` or `GIT_SSL_CAINFO` set on the container never reach them, and git reads no
  system config. Mount the CA certificate that signs the host's certificate into the fetcher at
  `/etc/ssl/certs/<hash>.0`, where `<hash>` is the output of
  `openssl x509 -hash -noout -in ca.crt`, as a ConfigMap item with `subPath`, read-only. Both
  tools find it there next to the system certificates; the checker needs it only in
  single-container mode, where it pulls itself.
- **Fetching a commit.** The depth-1 fetch asks for the revision commit by its id. The git server
  has to allow that: Git protocol v2, which GitLab and GitHub serve (a plain `git http-backend`
  needs the `Git-Protocol` request header passed on as `GIT_PROTOCOL`), or
  `uploadpack.allowReachableSHA1InWant` for protocol v0. Otherwise the fetcher falls back to the
  default branch, which may differ from the code the image was built from.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: sieb-ca
  namespace: sieb
data:
  ca.crt: |
    -----BEGIN CERTIFICATE-----
    <the private CA certificate>
    -----END CERTIFICATE-----
```

In the [Deployment](#kubernetes), add to the fetcher container and to the pod's volumes:

```yaml
volumeMounts:
  - name: ca
    mountPath: /etc/ssl/certs/<hash>.0
    subPath: ca.crt
    readOnly: true
```

```yaml
volumes:
  - name: ca
    configMap:
      name: sieb-ca
```

## Worker configuration

The checker container:

| Variable | Default | Meaning |
| --- | --- | --- |
| `SIEB_WORKER_URL` | required | Base URL of sieb's worker listener, for example `http://sieb.sieb.svc:3101` |
| `SIEB_WORKER_SECRET_FILE` or `SIEB_WORKER_SECRET` | required | File with, or value of, the same secret as sieb's `SIEB_WORKER_SECRET` |
| `ANTHROPIC_API_KEY_FILE` or `ANTHROPIC_API_KEY` | one credential required | File with, or value of, a Claude Console API key |
| `CLAUDE_CODE_OAUTH_TOKEN_FILE` or `CLAUDE_CODE_OAUTH_TOKEN` | one credential required | File with, or value of, a token from `claude setup-token` |
| `SIEB_CHECKER_WORKDIR` | `/work` | Directory for the check workspaces, needs room for the largest image |
| `SIEB_CHECKER_POLL_SECONDS` | `10` | Wait between claims while the queue is empty, 1 to 60 |
| `SIEB_CHECKER_IMAGE_MAX_BYTES` | `4294967296` (4 GiB) | Cap on the uncompressed filesystems of all images of a check together; a larger primary image fails the check, a further image that does not fit is skipped |
| `SIEB_CHECKER_PLATFORM` | `linux/amd64` | Platform exported from multi-platform images |
| `SIEB_CHECKER_MODEL` | the account default | Model alias or id passed to Claude Code as `--model`, for example `opus`, `sonnet` or `claude-opus-5-5`; letters, digits, `.`, `-` and `[]` only |
| `SIEB_CHECKER_EFFORT` | Claude Code's default | Effort level passed to Claude Code as `--effort`: `low`, `medium`, `high`, `xhigh` or `max` |
| `SIEB_CHECKER_WEB_DOMAINS` | the [default list](#web-access) | Comma or space separated hosts WebFetch may reach, `*.example.org` covers every subdomain; replaces the defaults |
| `SIEB_FETCHER_URL` | empty | `http://127.0.0.1:<port>` of the fetcher in the same pod, loopback only; empty runs in single-container mode |
| `SIEB_FETCHER_LOCAL_SECRET_FILE` or `SIEB_FETCHER_LOCAL_SECRET` | required with `SIEB_FETCHER_URL` | File with, or value of, the secret checker and fetcher share, at least 32 characters |
| `SIEB_CHECKER_SHARED_DIR` | `/shared` | Mount of the shared workspace volume, read-only here, must differ from `SIEB_CHECKER_WORKDIR` |

With the fetcher, `SIEB_CHECKER_WORKDIR` holds only Claude's home and the check's MCP config and
settings, and `SIEB_CHECKER_IMAGE_MAX_BYTES` and `SIEB_CHECKER_PLATFORM` take effect in the
fetcher.

The fetcher container:

| Variable | Default | Meaning |
| --- | --- | --- |
| `SIEB_WORKER_URL` | required | Base URL of sieb's worker listener, as for the checker |
| `SIEB_FETCHER_SECRET_FILE` or `SIEB_FETCHER_SECRET` | required | File with, or value of, the same secret as sieb's `SIEB_FETCHER_SECRET` |
| `SIEB_FETCHER_LOCAL_SECRET_FILE` or `SIEB_FETCHER_LOCAL_SECRET` | required | The secret shared with the checker |
| `SIEB_FETCHER_PORT` | `3102` | Port of the endpoint on `127.0.0.1` |
| `SIEB_CHECKER_WORKDIR` | `/work` | The fetcher's private directory |
| `SIEB_CHECKER_SHARED_DIR` | `/shared` | Mount of the shared workspace volume, read-write here |
| `SIEB_CHECKER_IMAGE_MAX_BYTES` | `4294967296` (4 GiB) | As for the checker in single-container mode |
| `SIEB_CHECKER_SOURCE_MAX_BYTES` | `536870912` (512 MiB) | Cap on the checked-out source; the fetch is stopped above it, the checkout above twice the cap (packed objects and tree together), and a tree above the cap is removed |
| `SIEB_CHECKER_PLATFORM` | `linux/amd64` | Platform exported from multi-platform images |

The fetcher never needs the Claude credential or `SIEB_WORKER_SECRET` and refuses to start with
either, also as a `_FILE` variant, so one Secret shared by both containers through `envFrom` fails
early.
Generate the local secret with, for example, `openssl rand -hex 32`.

Prefer the `_FILE` variants: a secret mounted as a file stays out of the worker's environment and
so out of `/proc/<pid>/environ`. Setting a variable and its `_FILE` variant together is refused.
Failed claims back off from the poll interval up to five minutes. On SIGTERM the worker stops
Claude, reports the running check as failed and exits.

## How a check runs

1. The worker claims a check and receives up to three images with their scanned digests, the
   prompt, the MCP URL and a short-lived token of the requester bound to the check's finding. A
   claim of an older sieb without the image list counts as its single image.
2. It creates `<workdir>/check-<id>/`. Without a scanned digest it resolves the tag's digest with
   `crane digest`; everything after that reads `repository@digest`, so a tag that moves during
   the check changes nothing. It gives every image, also a single one, its own directory
   `workspace/images/<n>-<tag>/` (`untagged` when sieb knows no tag) with `rootfs/` (the
   filesystem from `crane export`), `image-config.json` (`crane config`) and `inventory.json`
   (`syft`, trimmed to name, version, type, purl and paths when large). The byte cap applies to
   all images together: the primary image gets the whole cap, each further one what is left.
   A further image that would pass the cap, or whose pull fails, is removed and skipped, and the
   prompt names it as not pulled; a failing primary image fails the check. Outside the workspace
   it writes Claude's `home/` and `tmp/`, the MCP config (mode 600) with the sieb token and the
   inspect server, and the permission settings. With the fetcher, the fetcher does the pulls in
   `<shared>/check-<id>/` and adds `source/`, see [Two containers](#two-containers).
3. It runs `claude -p` in `workspace/` with a wall-clock limit of the check timeout and sends a
   heartbeat with the phase (`preparing`, `investigating`, `reporting`) every 30 seconds. When
   sieb answers a heartbeat with 409 (cancelled or timed out), the worker kills Claude.
4. It reports status, a short error, Claude's final reply, the token usage and the pulled
   digests, primary first; the primary one also ends the error or the reply as a note
   (`Pulled <repository>@<digest>`, with "the scanned digest is unknown" for a tag, and how many
   more images it pulled), and the checked-out source. sieb stores each digest with the tag its instances name for it, which
   the Checks page shows as the checked images. Then it deletes the check directory, also when sending
   the result failed; a 4xx answer other than 408 and 429 is not retried. Leftovers of a crashed
   worker are deleted at the next start.

## Security model

The image is untrusted input: its files can contain text written to steer Claude. The design keeps
what a steered Claude could reach small and keeps secrets out of its reach where the tooling
allows it.

**Secrets.** The worker holds two secrets, the Claude credential and the worker secret, and reads
both from mounted files when the `_FILE` variables are set. The worker secret never reaches a
child process. crane, tar and syft run with only `PATH`, `HOME` and `TMPDIR`, crane in the
fetcher also with `DOCKER_CONFIG`. Claude Code gets a
fresh environment: `PATH`, its own `HOME` and `TMPDIR`, the variables that turn off telemetry,
error reporting, auto-update, nonessential traffic, CLAUDE.md files, auto memory and transcripts,
and `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR=3` or `CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR=3`. The
credential itself arrives on file descriptor 3, which Claude Code reads once at start,
so it is neither in Claude's environment nor on its command line; Claude Code does not pass that
descriptor or the variable on to the MCP servers it starts. These variables are not in Claude
Code's public documentation; they were verified with Claude Code 2.1.326 (`claude auth status`
reports the credential, and a probe MCP server sees neither descriptor nor credential), so
re-check them when you change `CLAUDE_CODE_VERSION`. The sieb token sits only in the MCP config
outside Claude's working directory, expires shortly after the check timeout, is deleted when the
check ends, and reaches only the check's finding, its CVE and image (see
[Auto-check tokens](mcp.md#auto-check-tokens)).

**Registry and git credentials.** They reach only the fetcher: sieb hands them out on the
fetcher routes against `SIEB_FETCHER_SECRET`, which the checker refuses to hold. The fetcher
puts a registry login only into the `DOCKER_CONFIG` file in its private volume, which it removes
right after the pulls, and a git login only into the environment of the one `git fetch`, as an
`http.<repository URL>.extraHeader` in `GIT_CONFIG_*` variables: never on a command line, never
on disk, and not sent to another URL or after a redirect (`http.followRedirects=false`). git
runs without system or global config, credential helpers, hooks, submodules, prompts, background
maintenance, and with https as its only protocol; it checks every received object
(`transfer.fsckObjects`, `fetch.fsckObjects`), writes symlinks as plain files
(`core.symlinks=false`) and refuses paths unsafe on NTFS or HFS+. Error texts and log lines of a
check have its logins replaced by `[redacted]`, and every fetcher log line and error text also
has Authorization header values, Bearer and Basic credentials, token fields, URL userinfo and
token or signature query parameters masked, such as the pull tokens crane gets from a registry. The shared workspace receives only image files, inventories and the source tree
without `.git`; the tests scan it and every spawned command line for the logins.

**Two containers, two users.** The checker runs as another uid than the fetcher and shares only
the group, mounts the shared volume read-only and has no access to the fetcher's volume, its
secrets or its processes (separate PID namespaces, keep `shareProcessNamespace` off). Everything
the fetcher writes is group-readable and nothing for others (umask 027). So a steered Claude, or
a process that gets code execution in the checker, can read the workspace and what the checker
itself holds, but no registry or git credential. With the local secret it can ask the fetcher
to prepare the running check again: sieb answers the fetcher routes only for the running check,
and the fetcher pulls only the claim's images that sieb lists in its access answer, never other
images the checker names.

**Same user within a container.** In the checker, the worker, Claude Code, the inspect server and
every tool run as the same user. A process that gets code execution, for example through a memory
corruption bug in readelf, objdump, unzip, jq or GNU tar triggered by a crafted image file, can
read the memory of the worker and of Claude Code (same uid, no Yama) and so the worker secret,
the local secret and the Claude credential, and the MCP config with the sieb token; in
single-container mode crane, tar and syft run there too. Mounting the secrets as files only keeps
them out of `/proc/<pid>/environ`. In the fetcher, crane, GNU tar, syft and git parse untrusted
content under the uid that holds the check's logins: syft runs after the docker config is gone,
but an exploit in one of them could still read the logins from the fetcher's memory or from the
environment of a running `git fetch`. Keep the image current so these parsers get their fixes.

**Image extraction.** The export stream passes a filter before `tar -x`: it enforces the byte cap
on the uncompressed stream, drops absolute and `..` paths, device files and fifos, entries below
an extracted symlink or below a hard link to one, hard links to directories and to anything not
extracted, and the ignore files ripgrep honours (`.gitignore`, `.ignore`, `.rgignore`,
`.git/info/exclude`), which would hide image files from Claude's Grep. It writes fresh root-owned
headers without setuid, setgid or sticky bits. GNU tar extracts with `--no-same-owner
--no-same-permissions`. Afterwards absolute symlinks, and relative ones that climb above the
image root, are rewritten as they resolve in the container, and every symlink that still resolves
outside the root is removed, so no path below an image's `rootfs/` leads to another image or the
worker's own files.

**Claude Code permissions.** Claude gets the built-in tools `Read`, `Grep`, `Glob`, `WebFetch`
and `WebSearch` only (`--tools`), so `Bash`, `Edit`, `Write`, subagents and the rest are absent,
and only two MCP servers (`--strict-mcp-config`): sieb and the local inspect server. The session
runs non-interactively with an explicit allow list: the sieb tools, the inspect tools,
`WebFetch(domain:<host>)` for each [allowed host](#web-access) and WebSearch. Every other call
that needs approval, a WebFetch to any other host included, is denied, not prompted, and `Bash`
is also in the deny list. File tools are confined to the workspace (`blockReadsOutsideWorkingDirectories`,
`blockWritesOutsideWorkingDirectories`), with deny rules for `/proc`, `/sys`, `/dev`, `/run`,
`/etc`, `/home`, `/root`, `/tmp`, the MCP config and the settings. Hooks, skills, slash commands
and auto memory are off.

**Why there is no shell.** A shell would give a steered Claude every program in the image of the
worker, `/proc` with the memory of the processes that hold the Claude credential, and the MCP
config with the sieb token. Claude Code's Bash
rules match command text and are no boundary, and its built-in read-only commands such as `cat`
or `find` cannot be switched off. Isolating Bash needs bubblewrap and unprivileged user
namespaces, which container runtimes block under their default seccomp profile. Instead, the few
binary tools a triage needs run behind the inspect server, which checks every argument.

### Web access

WebFetch reaches only the hosts of `SIEB_CHECKER_WEB_DOMAINS`. A rule matches its host only,
`*.example.org` matches every subdomain but not `example.org` itself. The default list:

| Purpose | Hosts |
| --- | --- |
| CVE databases and advisories | `nvd.nist.gov`, `services.nvd.nist.gov`, `cve.org`, `www.cve.org`, `cveawg.mitre.org`, `www.cisa.gov`, `osv.dev`, `api.osv.dev` |
| Source hosting | `github.com`, `api.github.com`, `raw.githubusercontent.com` |
| Go | `pkg.go.dev`, `go.dev`, `proxy.golang.org`, `vuln.go.dev` |
| Distro trackers | `security-tracker.debian.org`, `tracker.debian.org`, `ubuntu.com`, `launchpad.net`, `security.alpinelinux.org`, `secdb.alpinelinux.org`, `pkgs.alpinelinux.org`, `access.redhat.com`, `bugzilla.redhat.com`, `www.suse.com`, `lists.suse.com`, `bugzilla.suse.com`, `bodhi.fedoraproject.org`, `alas.aws.amazon.com`, `linux.oracle.com`, `errata.almalinux.org`, `errata.rockylinux.org`, `packages.wolfi.dev` |
| Package registries | `www.npmjs.com`, `registry.npmjs.org`, `pypi.org`, `crates.io`, `rubygems.org`, `central.sonatype.com`, `repo1.maven.org`, `search.maven.org` |
| Image registries | `hub.docker.com`, `quay.io`, `ghcr.io` |

Claude Code also lets WebFetch reach a built-in set of preapproved documentation hosts without a
rule. WebSearch stays on: it runs on Anthropic's side and returns results, which Claude can then
only fetch from the hosts above.

The list narrows exfiltration, it does not close it. A steered Claude can still put what it read
into the path or query of a request to an allowed host, for example a GitHub URL, and whoever
operates that host or controls content there may see it; and it can put text into search
queries. What it can read is limited to the public image, the prompt and sieb's answers for the
check's finding, its CVE and image. Shorten the list to tighten this, for example to the hosts of
your own distro and ecosystems.

### Inspect tools

The inspect server is a stdio MCP server shipped with the worker. Claude Code starts it for each
check with the workspace as its only argument and `PATH` as its only configured variable; it
inherits Claude's environment on top (`HOME`, `TMPDIR`, the quiet variables and Claude Code's
session variables), without the Claude credential. The commands it runs get `PATH` only. Its
tools are read-only and named `mcp__inspect__<tool>`:

| Tool | Arguments | Runs |
| --- | --- | --- |
| `strings` | `path`, `minLength` (3 to 64, default 6), `pattern`, `regex`, `ignoreCase` | `strings -a -n <minLength>`, lines filtered by plain text in Node or by an extended regular expression through `grep -E` |
| `readelf` | `path`, `mode`: `header`, `sections`, `segments`, `dynamic`, `symbols`, `dynamic_symbols`, `notes`, `versions`, and the same `pattern`, `regex`, `ignoreCase` as `strings` | `readelf` with the fixed flags of the mode, wide output |
| `objdump` | `path`, `mode`: `private_headers`, `section_headers`, `disassemble_symbol`, `symbol` for the latter, and the same `pattern` filter | `objdump -p`, `-h -w` or `-d --no-show-raw-insn --disassemble=<symbol>` |
| `unzip_list` | `path` | `unzip -l`, lists without extracting |
| `jq` | `path` of a `.json` file up to 64 MiB, `filter` up to 500 characters | `jq -M -- <filter> <path>` |

Every path is resolved with all symlinks followed and must be a regular file inside the
workspace; absolute paths, `..` and symlinks that lead outside are refused. Commands run without
a shell, with `PATH` as their whole environment, the workspace as working directory, a 30 second
timeout and 64 KiB of output: a command is stopped at the cap and its output cut with a note,
while only the tail of stderr is kept, so a failing command reports its exit code however much it
writes there. With a `pattern`, `strings` reads at most 32 MiB of strings output and says so when
matches past that point are missing. `readelf` and `objdump` take the same filter and apply it before the cap; output still over the cap ends with the number of dropped lines and a hint to add or narrow the pattern. A symbol
for `disassemble_symbol` may contain letters, digits and `_ . $ @` only. A jq filter must not use
`import`, `include`, `env`, `$ENV`, `input_filename` or the module search builtins. objdump disassembles only code of the worker's own architecture, so run the worker on nodes
that match `SIEB_CHECKER_PLATFORM`; readelf, strings and the other tools read any architecture. Go build
information needs no tool of its own: syft records the Go modules of binaries in
`inventory.json`.

**Known limits.**

- WebFetch is limited to the [allowed hosts](#web-access) and WebSearch stays on, so a steered
  Claude can still leak what it read through request paths and search queries.
- The same user runs every process of a container, see *Same user within a container* above.
- The reply is shown as untrusted plain text, and a proposal changes nothing until a person
  accepts it in sieb.

Contain the rest in Kubernetes: no service account token, a read-only root filesystem, a size
limit on the work volume, no capabilities and the [NetworkPolicy](#networkpolicy), which is
required: the WebFetch allow list is a Claude Code rule, not a network boundary, and a process
that escapes it, such as a tool exploited through a crafted image file, could otherwise reach
internal services and the cloud metadata endpoint.

## Kubernetes

Example manifests for the namespace of sieb with both containers, adapt image tag, resources and
the sieb Service name. For single-container mode drop the fetcher container, its Secret and
volumes, `SIEB_FETCHER_URL` and `SIEB_FETCHER_LOCAL_SECRET_FILE`, and mount the work volume alone.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sieb-checker
  namespace: sieb
type: Opaque
stringData:
  worker-secret: <same value as SIEB_WORKER_SECRET of sieb>
  # one of the two: an API key from the Claude Console, or for your own use only the output of
  # claude setup-token under the key claude-token and CLAUDE_CODE_OAUTH_TOKEN_FILE below
  anthropic-api-key: <API key>
  local-secret: <openssl rand -hex 32, the same value as in sieb-fetcher>
---
apiVersion: v1
kind: Secret
metadata:
  name: sieb-fetcher
  namespace: sieb
type: Opaque
stringData:
  fetcher-secret: <same value as SIEB_FETCHER_SECRET of sieb>
  local-secret: <the same value as in sieb-checker>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sieb-checker
  namespace: sieb
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app.kubernetes.io/name: sieb-checker
  template:
    metadata:
      labels:
        app.kubernetes.io/name: sieb-checker
    spec:
      automountServiceAccountToken: false
      enableServiceLinks: false
      shareProcessNamespace: false
      terminationGracePeriodSeconds: 60
      securityContext:
        runAsNonRoot: true
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: fetcher
          image: ghcr.io/bernhardkelm/sieb-checker:0.6.0
          args: [src/checker/fetcher/fetcherMain.ts]
          env:
            - name: SIEB_WORKER_URL
              value: http://sieb.sieb.svc:3101
            - name: SIEB_FETCHER_SECRET_FILE
              value: /run/secrets/sieb-fetcher/fetcher-secret
            - name: SIEB_FETCHER_LOCAL_SECRET_FILE
              value: /run/secrets/sieb-fetcher/local-secret
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 1Gi
          securityContext:
            runAsUser: 1001
            runAsGroup: 1000
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: [ALL]
          volumeMounts:
            - name: shared
              mountPath: /shared
            - name: fetcher-work
              mountPath: /work
            - name: fetcher-secrets
              mountPath: /run/secrets/sieb-fetcher
              readOnly: true
        - name: checker
          image: ghcr.io/bernhardkelm/sieb-checker:0.6.0
          env:
            - name: SIEB_WORKER_URL
              value: http://sieb.sieb.svc:3101
            - name: SIEB_WORKER_SECRET_FILE
              value: /run/secrets/sieb-checker/worker-secret
            - name: ANTHROPIC_API_KEY_FILE
              value: /run/secrets/sieb-checker/anthropic-api-key
            - name: SIEB_FETCHER_URL
              value: http://127.0.0.1:3102
            - name: SIEB_FETCHER_LOCAL_SECRET_FILE
              value: /run/secrets/sieb-checker/local-secret
          resources:
            requests:
              cpu: 250m
              memory: 1Gi
            limits:
              cpu: "2"
              memory: 3Gi
          securityContext:
            runAsUser: 1000
            runAsGroup: 1000
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: [ALL]
          volumeMounts:
            - name: shared
              mountPath: /shared
              readOnly: true
            - name: checker-work
              mountPath: /work
            - name: checker-secrets
              mountPath: /run/secrets/sieb-checker
              readOnly: true
      volumes:
        - name: shared
          emptyDir:
            sizeLimit: 12Gi
        - name: fetcher-work
          emptyDir:
            sizeLimit: 1Gi
        - name: checker-work
          emptyDir:
            sizeLimit: 1Gi
        - name: fetcher-secrets
          secret:
            secretName: sieb-fetcher
            defaultMode: 0400
        - name: checker-secrets
          secret:
            secretName: sieb-checker
            defaultMode: 0400
```

Each container mounts only its own Secret and its own work volume; `fsGroup` makes the volumes
and the Secret files group-readable for gid 1000, which both containers share, while the
fetcher's uid 1001 keeps the checker out of its processes. The shared volume holds one check at
a time: its image filesystems up to `SIEB_CHECKER_IMAGE_MAX_BYTES` in total plus the inventories
and up to twice `SIEB_CHECKER_SOURCE_MAX_BYTES` while the source is checked out. The fetcher's
work volume holds the untrimmed syft output, the checker's Claude's home. Size them above the
caps; when a volume runs full, the kubelet evicts the pod and sieb fails the check after the
missing heartbeats.

### NetworkPolicy

The policy is required. The worker accepts no connections; the fetcher's endpoint listens on the
pod's loopback address only. It needs DNS, sieb's worker port, and HTTPS to the registries, the
git hosts, Anthropic, the web pages Claude fetches and sieb's public URL, which carries the MCP
endpoint. Everything private stays closed: RFC 1918, the shared address
space `100.64.0.0/10` that some CNIs and cloud networks use, and the link-local
`169.254.0.0/16`, which holds the cloud metadata endpoint:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sieb-checker
  namespace: sieb
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: sieb-checker
  policyTypes: [Ingress, Egress]
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: sieb
      ports:
        - port: 3101
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
              - 100.64.0.0/10
              - 169.254.0.0/16
      ports:
        - port: 443
          protocol: TCP
```

Allow the worker in sieb's own ingress policy on the worker port:

```yaml
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: sieb-checker
      ports:
        - port: 3101
```

When sieb's public URL or a self-hosted GitLab resolves to an address inside the cluster or your
network, for example the ingress controller, also allow that address on port 443.

## Local development

Run the worker image against a sieb on your machine, for example in mock mode. Build it with
`docker build -f Dockerfile.checker -t sieb-checker:local .`, start sieb with Auto-check on and
point both at each other:

```sh
openssl rand -hex 32 > worker-secret
SIEB_MCP_ENABLED=true SIEB_CHECKS_ENABLED=true \
  SIEB_PUBLIC_URL=http://host.docker.internal:3100 \
  SIEB_ALLOWED_HOSTS=host.docker.internal:3100 \
  SIEB_WORKER_PORT=3101 SIEB_WORKER_SECRET="$(cat worker-secret)" \
  npm run dev:server:mock
```

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

- **The MCP URL must work from inside the container.** The worker hands Claude `/mcp` on
  `SIEB_PUBLIC_URL`, so `http://localhost:3100` would point at the container itself. Use an
  address the container reaches, such as `host.docker.internal`, and accept it in sieb's host
  guard with `SIEB_ALLOWED_HOSTS`; only loopback hosts pass without it.
- **Linux.** Add `--add-host=host.docker.internal:host-gateway` to `docker run`. sieb listens on
  `127.0.0.1` by default, which the container cannot reach: set `SIEB_HOST` to the Docker bridge
  address (often `172.17.0.1`) or `0.0.0.0`, and keep the ports closed to your network with a
  firewall. Docker Desktop on macOS and Windows needs neither.
- The worker needs GNU tar, crane, syft and the inspect binaries, so run it from the image rather
  than with `node src/checker/main.ts` on macOS.
- **Two containers.** Start the fetcher first and join the checker to its network namespace, so
  `127.0.0.1:3102` reaches it; a named volume with group 1000 and mode 2770 stands in for the
  `fsGroup` emptyDir (it keeps its mode while it is not empty):

  ```sh
  openssl rand -hex 32 > local-secret
  docker run --rm --user 0 --entrypoint sh -v sieb-shared:/shared sieb-checker:local \
    -c 'chown 0:1000 /shared && chmod 2770 /shared && touch /shared/.keep'
  docker run -d --name sieb-fetcher --read-only --cap-drop ALL --security-opt no-new-privileges \
    --user 1001:1000 --tmpfs /work:rw,size=2g,uid=1001,gid=1000,mode=0700 -v sieb-shared:/shared \
    -v "$PWD/fetcher-secret:/run/secrets/fetcher-secret:ro" -v "$PWD/local-secret:/run/secrets/local-secret:ro" \
    -e SIEB_WORKER_URL=http://host.docker.internal:3101 \
    -e SIEB_FETCHER_SECRET_FILE=/run/secrets/fetcher-secret \
    -e SIEB_FETCHER_LOCAL_SECRET_FILE=/run/secrets/local-secret \
    sieb-checker:local src/checker/fetcher/fetcherMain.ts
  ```

  Then run the checker as above with `--network container:sieb-fetcher`,
  `-v sieb-shared:/shared:ro`, the local secret mounted, `-e SIEB_FETCHER_URL=http://127.0.0.1:3102`
  and `-e SIEB_FETCHER_LOCAL_SECRET_FILE=...`. Give sieb the same `SIEB_FETCHER_SECRET` as the
  fetcher. Mounted secret files must be readable by the container's uid or group.

## Image

`ghcr.io/bernhardkelm/sieb-checker` is built from `Dockerfile.checker` with the same tags and
platforms (`linux/amd64`, `linux/arm64`) as the main image. It contains:

- Node from the `node:<version>-alpine` base image, pinned by its index digest (`NODE_IMAGE`);
- the worker source with all of `src/core`, and the MCP server SDK and zod for the inspect server;
- Claude Code, the native binary of `@anthropic-ai/claude-code-linux-<arch>-musl` taken from its
  npm tarball after checking the registry's sha512 `dist.integrity`
  (`CLAUDE_CODE_VERSION`, `CLAUDE_CODE_INTEGRITY_AMD64`, `CLAUDE_CODE_INTEGRITY_ARM64`), so no
  install script runs;
- crane and syft as release binaries checked against their published sha256 sums
  (`CRANE_VERSION`, `SYFT_VERSION` with their checksums);
- from Alpine, pinned to their upstream version (`apk add pkg~x.y.z`, which admits Alpine's
  security rebuilds): the binaries behind the inspect tools (`binutils`, `jq`, `unzip`), GNU
  `tar`, `git` for the fetcher's checkouts, `bash`, which Claude Code requires on Alpine, and
  `tini` as init, which forwards SIGTERM to the worker and reaps the processes of killed process
  groups.

The entrypoint is `tini -- node` with `src/checker/main.ts`, the checker, as default command; the
fetcher runs the same image with the command `src/checker/fetcher/fetcherMain.ts`. It runs as the
non-root user `node` (the fetcher under the uid you give it) and writes only below `/work` and
`/shared`. To update Claude Code, take
both `dist.integrity` values from `npm view @anthropic-ai/claude-code-linux-x64-musl@<version>
dist.integrity` and its `arm64` sibling, and re-check the credential descriptor described under
[Security model](#security-model). CI runs the image once before publishing it: it must refuse to
start without `SIEB_WORKER_URL` as checker and as fetcher (the latter under uid 1001), print the
git and Claude Code versions and answer `tools/list` on the inspect server.
