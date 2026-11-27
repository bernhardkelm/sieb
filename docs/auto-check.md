# Auto-check

Auto-check lets you queue findings for an unattended investigation by Claude. A separate worker,
`sieb-checker`, takes one check at a time, prepares a throwaway workspace with the files of the
image, runs headless Claude Code against it and lets Claude file its verdict as a normal
[proposal](mcp.md#proposals) through sieb's MCP endpoint. Nothing changes in sieb until a person
accepts or rejects the proposal. The routes, states and timeouts are described in
[api.md](api.md#auto-check).

## What it does and what it does not

- **Public images only.** sieb queues only findings whose image has source access `public` (see
  [source access](api.md#source-access)). The worker has no registry credentials and pulls the
  image anonymously.
- **One check at a time.** sieb runs at most one check, the worker claims the oldest queued one.
  Run a single worker replica.
- **No cluster access.** The worker needs no service account and never talks to the Kubernetes
  API. It reaches sieb's worker port, the registries, Anthropic and the web.
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
- **What Claude does not see:** no source repository, no running container, no cluster, no images
  of other findings and no files of the worker. A verdict that depends on how the image is deployed or on
  your own source names those under *Not checked*.

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

## Worker configuration

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
   inspect server, and the permission settings.
3. It runs `claude -p` in `workspace/` with a wall-clock limit of the check timeout and sends a
   heartbeat with the phase (`preparing`, `investigating`, `reporting`) every 30 seconds. When
   sieb answers a heartbeat with 409 (cancelled or timed out), the worker kills Claude.
4. It reports status, a short error, Claude's final reply, the token usage and the pulled
   digests, primary first; the primary one also ends the error or the reply as a note
   (`Pulled <repository>@<digest>`, with "the scanned digest is unknown" for a tag, and how many
   more images it pulled). sieb stores each digest with the tag its instances name for it, which
   the Checks page shows as the checked images. Then it deletes the check directory, also when sending
   the result failed; a 4xx answer other than 408 and 429 is not retried. Leftovers of a crashed
   worker are deleted at the next start.

## Security model

The image is untrusted input: its files can contain text written to steer Claude. The design keeps
what a steered Claude could reach small and keeps secrets out of its reach where the tooling
allows it.

**Secrets.** The worker holds two secrets, the Claude credential and the worker secret, and reads
both from mounted files when the `_FILE` variables are set. The worker secret never reaches a
child process. crane, tar and syft run with only `PATH`, `HOME` and `TMPDIR`. Claude Code gets a
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

**Same user, one container.** The worker, Claude Code, the inspect server and every tool run as
the same user in one container. A process that gets code execution, for example through a memory
corruption bug in readelf, objdump, unzip, jq or GNU tar triggered by a crafted image file, can
read the memory of the worker and of Claude Code (same uid, no Yama) and so the worker secret and
the Claude credential, and the MCP config with the sieb token. Mounting the secrets as files only
keeps them out of `/proc/<pid>/environ`. Keep the image current so these parsers get their fixes.
A possible next step is a two-container split: crane, tar, syft and the inspect commands in a
sidecar that holds no secrets and shares only the work volume, or the same under a separate uid.

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
- The same user runs every process of the worker, see *Same user, one container* above.
- The reply is shown as untrusted plain text, and a proposal changes nothing until a person
  accepts it in sieb.

Contain the rest in Kubernetes: no service account token, a read-only root filesystem, a size
limit on the work volume, no capabilities and the [NetworkPolicy](#networkpolicy), which is
required: the WebFetch allow list is a Claude Code rule, not a network boundary, and a process
that escapes it, such as a tool exploited through a crafted image file, could otherwise reach
internal services and the cloud metadata endpoint.

## Kubernetes

Example manifests for the namespace of sieb, adapt image tag, resources and the sieb Service name.

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
      terminationGracePeriodSeconds: 60
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
        - name: checker
          image: ghcr.io/bernhardkelm/sieb-checker:0.4.0
          env:
            - name: SIEB_WORKER_URL
              value: http://sieb.sieb.svc:3101
            - name: SIEB_WORKER_SECRET_FILE
              value: /run/secrets/sieb-checker/worker-secret
            - name: ANTHROPIC_API_KEY_FILE
              value: /run/secrets/sieb-checker/anthropic-api-key
          resources:
            requests:
              cpu: 250m
              memory: 1Gi
              ephemeral-storage: 1Gi
            limits:
              cpu: "2"
              memory: 3Gi
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: [ALL]
            seccompProfile:
              type: RuntimeDefault
          volumeMounts:
            - name: work
              mountPath: /work
            - name: secrets
              mountPath: /run/secrets/sieb-checker
              readOnly: true
      volumes:
        - name: work
          emptyDir:
            sizeLimit: 12Gi
        - name: secrets
          secret:
            secretName: sieb-checker
            defaultMode: 0400
```

The work volume holds one check at a time: its image filesystems up to `SIEB_CHECKER_IMAGE_MAX_BYTES` in total
plus the syft output and Claude's home. Size it above the cap; when the volume runs full, the
kubelet evicts the pod and sieb fails the check after the missing heartbeats.

### NetworkPolicy

The policy is required. The worker accepts no connections. It needs DNS, sieb's worker port, and
HTTPS to the registries, to Anthropic, to the web pages Claude fetches and to sieb's public URL,
which carries the MCP endpoint. Everything private stays closed: RFC 1918, the shared address
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

When sieb's public URL resolves to an address inside the cluster, for example the ingress
controller, also allow that address on port 443.

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
  `tar`, `bash`, which Claude Code requires on Alpine, and `tini` as init, which forwards
  SIGTERM to the worker and reaps the processes of killed process groups.

It runs as the non-root user `node` and writes only below `/work`. To update Claude Code, take
both `dist.integrity` values from `npm view @anthropic-ai/claude-code-linux-x64-musl@<version>
dist.integrity` and its `arm64` sibling, and re-check the credential descriptor described under
[Security model](#security-model). CI runs the image once before publishing it: it must refuse to
start without `SIEB_WORKER_URL`, print the Claude Code version and answer `tools/list` on the
inspect server.
