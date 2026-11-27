# Auto-check internals

This reference is for a security reviewer or contributor who needs to know exactly what happens
during an Auto-check: which process holds which secret, what reaches Claude, what Claude may do
and where the design stops protecting you. Setup and daily use are in the
[Auto-check guide](../auto-check.md).

On this page

- [Threat model](#threat-model)
- [How a check runs](#how-a-check-runs)
- [Two containers](#two-containers)
- [Secrets](#secrets)
- [Registry and git credentials](#registry-and-git-credentials)
- [Image extraction](#image-extraction)
- [What reaches Claude](#what-reaches-claude)
- [Claude Code permissions](#claude-code-permissions)
- [Web access](#web-access)
- [Inspect tools](#inspect-tools)
- [Known limits](#known-limits)
- [Worker image](#worker-image)

## Threat model

The image under investigation is untrusted input in two ways. Its files can contain text written
to steer Claude (prompt injection). Its files can also be crafted to exploit the tools that parse
them: crane, GNU tar, syft, git, readelf, objdump, unzip and jq.

The design answers both with the same three ideas. Keep what Claude can do small and read-only.
Keep secrets out of the processes that touch untrusted content where the tooling allows it. Let
nothing a check produces take effect without a person: the only output is a proposal.

The worker never talks to the Kubernetes API and needs no service account.

## How a check runs

The worker image has two commands. The checker (`src/checker/main.ts`, the default) claims checks
and runs Claude. The fetcher (`src/checker/fetcher/fetcherMain.ts`) pulls images and checks out
source. The steps below describe the two-container layout; the differences of the
single-container layout follow.

1. The checker polls `POST /worker/claim` on sieb's worker listener. sieb hands out the oldest
   queued check, and only while no check runs. The claim carries up to three images with their
   scanned digests, the prompt, the MCP URL, the timeout, the turn limit and a
   [check token](mcp.md#auto-check-tokens).
2. The checker creates its private directory `<workdir>/check-<id>/` and posts the check id and
   the time left to the fetcher's `/prepare` endpoint.
3. The fetcher asks sieb for the registry logins and the image list of the check
   (`POST /worker/checks/<id>/access`), pulls the images into `<shared>/check-<id>/images/`,
   writes the inventories and checks out the source into `<shared>/check-<id>/source/`. See
   [Two containers](#two-containers) for the details.
4. The checker verifies that it can read the workspace, writes the MCP config (mode 600) and the
   permission settings into its private directory, and runs `claude -p` with the workspace as
   working directory and the time left as wall-clock limit.
5. Claude investigates and files its verdict through sieb's MCP endpoint with the check token.
6. The checker reports the result to sieb: status, a short error, Claude's final reply, token
   usage and models, the digests it pulled (primary first) and the checked-out source. It then
   asks the fetcher to release the check and deletes its own check directory.

Per image the workspace holds `images/<n>-<tag>/` (`untagged` when sieb knows no tag) with:

| Entry | Content | Made by |
| --- | --- | --- |
| `rootfs/` | Flattened filesystem for one platform | `crane export` through the tar filter |
| `image-config.json` | Environment, entrypoint, labels, history | `crane config` |
| `inventory.json` | Packages, trimmed to name, version, type, purl and paths when large | `syft` |

Rules that hold during a run:

- Every pull reads `repository@digest`. When sieb knows no digest, the worker resolves the tag
  once with `crane digest`, so a tag that moves during the check changes nothing. The result
  then carries a note that the scanned digest is unknown.
- The byte cap (`SIEB_CHECKER_IMAGE_MAX_BYTES`) covers all images of a check together. The
  primary image gets the whole cap, each further image what is left. A further image that does
  not fit, or whose pull fails, is removed and named in the prompt as not pulled. A failing
  primary image fails the check.
- The checker sends a heartbeat with the phase (`preparing`, `investigating`, `reporting`) every
  30 seconds. When sieb answers 409 because the check was cancelled or timed out, the checker
  kills Claude's process group or closes the fetcher request, which stops the fetcher's tools.
- sieb fails a running check without a heartbeat for 2 minutes, or one that runs longer than
  `SIEB_CHECK_TIMEOUT_SECONDS` plus one minute. It evaluates this on every claim, heartbeat and
  read of the checks, and every 30 seconds.
- The result is sent up to three times. A 4xx answer other than 408 and 429 is final. The check
  directory is deleted whether or not the result arrived.
- Failed claims back off from the poll interval up to five minutes. On SIGTERM the checker stops
  Claude, reports the running check as failed with "worker stopped" and exits.
- Both containers delete leftovers of earlier checks at start. The fetcher also does so before
  every preparation.

In the single-container layout (no `SIEB_FETCHER_URL`) the checker does step 3 itself: it pulls
anonymously into `<workdir>/check-<id>/workspace/`, never asks sieb for a login and checks out no
source. A pull the registry refuses fails with "the image needs a registry credential, which only
the fetcher container uses (SIEB_FETCHER_URL)".

The routes are specified in [Worker listener](api.md#worker-listener), the variables in
[Checker container](configuration.md#checker-container) and
[Fetcher container](configuration.md#fetcher-container).

## Two containers

Both containers run in one pod from the same image.

```text
pod sieb-checker
  fetcher  uid 1001, gid 1000   SIEB_FETCHER_SECRET, local secret,
                                registry and git logins of the running check
     ^  POST /ready, /prepare, /release on 127.0.0.1:3102, bearer local secret
  checker  uid 1000, gid 1000   Claude credential, SIEB_WORKER_SECRET, local secret,
                                sieb token of the running check
  volumes  shared        fetcher read-write, checker read-only: images/ and source/
           fetcher-work  HOME, TMPDIR, DOCKER_CONFIG, untrimmed syft output
           checker-work  Claude's HOME and TMPDIR, MCP config, settings
```

What separates them:

- Different uids, same gid. Everything the fetcher writes is readable for the group and closed to
  others (umask 027), so the checker can read the workspace and nothing else of the fetcher.
- The checker mounts the shared volume read-only and does not mount the fetcher's work volume or
  Secret.
- Separate PID namespaces. `shareProcessNamespace` must stay off, otherwise the uid no longer
  keeps the checker out of the fetcher's processes.
- The fetcher's endpoint listens on the pod's loopback address only. The checker accepts
  `SIEB_FETCHER_URL` only as plain http to a loopback address.
- Each container refuses to start with a secret of the other, also as a `_FILE` variant. The
  checker refuses `SIEB_FETCHER_SECRET`. The fetcher refuses `SIEB_WORKER_SECRET`,
  `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_AUTH_TOKEN`.

What the fetcher does in `/prepare`:

1. It asks sieb for the access of the check. sieb answers only for the running check, with the
   images of the claim and at most one registry login, for the registry host of the check's image
   and no other host.
2. It writes the login into a `DOCKER_CONFIG` directory (mode 700, file 600) in its private
   volume, pulls the images sieb listed, and deletes the directory before anything else runs. It
   ignores image names the checker sends. An answer without images fails the preparation.
3. It runs syft, after the docker config is gone.
4. It reads the `org.opencontainers.image.source` and `org.opencontainers.image.revision` labels
   of the primary image and asks sieb for the source (`POST /worker/checks/<id>/source`). sieb
   answers with one to three repository URLs and a login, with the URLs alone for an anonymous
   clone, or with a reason to skip.
5. For each URL in turn it runs `git init`, a depth-1 `git fetch` over https and
   `git checkout`. It deletes `.git` and the ignore files, contains symlinks like those of an
   image and enforces the size cap. All attempts together get at most five minutes.

sieb chooses the repository in this order: the image's own source label, an explicit repository
mapping of a credential, the default mapping of the provider. A label counts only for a
repository of the image's own owner (the first path segment). An anonymous clone is granted only
on github.com, gitlab.com or the git host of a stored credential, never on an internal host name.

The fetcher chooses the commit in this order: the revision label when it is a commit id, then
`refs/tags/<tag>` and `refs/tags/v<tag>` for the tag of the primary image, then the default
branch. sieb passes the revision on only for the label's own repository or for an image without
a source label, because an inherited label names the commit of the base image. Tags are tried
only for names of letters, digits and `._+-`, never for `latest` or a digest-only image.

A missing source never fails the check. The prompt names the reason, and the result carries no
source. An anonymous grant whose URLs all fail to clone is reported as a repository that needs a
credential. A fetch above `SIEB_CHECKER_SOURCE_MAX_BYTES` is stopped, a checkout above twice the
cap as well, and a tree above the cap is removed.

## Secrets

| Secret | Held by | How it is protected |
| --- | --- | --- |
| Claude credential | Checker | Read from a mounted file, handed to Claude Code on file descriptor 3 |
| `SIEB_WORKER_SECRET` | sieb, checker | Never passed to a child process |
| Local secret | Checker, fetcher | Authenticates the loopback endpoint, at least 32 characters |
| `SIEB_FETCHER_SECRET` | sieb, fetcher | The only bearer sieb accepts on the two fetcher routes |
| Check token | Checker | In the MCP config outside the workspace, mode 600, deleted with the check |
| Registry login | Fetcher, per check | In a `DOCKER_CONFIG` file, removed right after the pulls |
| Git login | Fetcher, per check | In the environment of the one `git fetch` only |
| Credentials key | sieb | Seals the stored credentials, never leaves sieb |

Child processes get a fresh environment, not the worker's:

- crane, tar and syft get `PATH`, `HOME` and `TMPDIR`, crane in the fetcher also
  `DOCKER_CONFIG`.
- Claude Code gets `PATH`, its own `HOME` and `TMPDIR`, variables that turn off telemetry, error
  reporting, auto-update, nonessential traffic, instruction files, auto memory and prompt
  history, and `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR=3` or
  `CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR=3`.

Claude Code reads the credential once from that descriptor at start. The credential is therefore
neither in Claude's environment nor on its command line, and Claude Code does not pass the
descriptor or the variable on to the MCP servers it starts. These two variables are not in Claude
Code's public documentation. They were verified with the pinned Claude Code version of the image
(`claude auth status` reports the credential, and a probe MCP server sees neither descriptor nor
credential), and have to be verified again whenever `CLAUDE_CODE_VERSION` changes.

The check token is a token of the requester with the scope to propose. It reaches only the
finding of the check, its CVE and its image, expires 10 minutes after the check timeout and is
deleted when the check ends, see [Auto-check tokens](mcp.md#auto-check-tokens).

Mounting secrets as files (the `_FILE` variables) keeps them out of `/proc/<pid>/environ`. It
does not protect them from a process of the same user that reads memory, see
[Known limits](#known-limits).

## Registry and git credentials

sieb stores them sealed with AES-256-GCM, bound to their row, provider, hosts and path prefix,
see [Access credentials](api.md#access-credentials). It hands a login out only on the fetcher
routes, only for a running check, and writes one log line per hand-out without username or
secret.

In the fetcher:

- A registry login exists only in the `DOCKER_CONFIG` file described above.
- A git login is passed as an `http.<repository URL>.extraHeader` through `GIT_CONFIG_*`
  variables of the one `git fetch`. It is never on a command line and never on disk, and git does
  not send it to another URL or after a redirect (`http.followRedirects=false`).
- git runs without system or global config, credential helpers, hooks, submodules, prompts or
  background maintenance, with https as its only protocol. It checks every received object
  (`transfer.fsckObjects`, `fetch.fsckObjects`), writes symlinks as plain files
  (`core.symlinks=false`) and refuses paths that are unsafe on NTFS or HFS+.
- Error texts and log lines of a check have its logins replaced by `[redacted]`. Every fetcher
  log line also has Authorization header values, Bearer and Basic credentials, token fields, URL
  userinfo and token or signature query parameters masked, such as the pull tokens crane gets
  from a registry.

The shared workspace receives only image files, inventories and the source tree without `.git`.
The test suite scans the workspace and every spawned command line for the logins.

With the local secret, a compromised checker can ask the fetcher to prepare the running check
again. It cannot widen the access: sieb answers the fetcher routes only for the running check,
and the fetcher pulls only the images sieb lists.

## Image extraction

The stream of `crane export` passes a filter before `tar -x`. The filter:

- enforces the byte cap on the uncompressed stream;
- drops absolute paths and paths with `..`, device files and fifos;
- drops entries below an extracted symlink or below a hard link to one, hard links to
  directories and hard links to anything that was not extracted;
- drops the ignore files ripgrep honors (`.gitignore`, `.ignore`, `.rgignore`,
  `.git/info/exclude`), which would hide image files from Claude's search;
- writes fresh root-owned headers without setuid, setgid or sticky bits.

GNU tar extracts with `--no-same-owner --no-same-permissions`. Afterwards absolute symlinks, and
relative ones that climb above the image root, are rewritten to where they resolve inside the
container. Every symlink that still resolves outside the root is removed. No path below an
image's `rootfs/` therefore leads to another image or to files of the worker.

## What reaches Claude

Claude reads:

- The prompt: sieb's investigation prompt for the finding, plus the worker's description of the
  workspace, the pulled and skipped images and the source or the reason it is missing.
- The workspace: `images/` and, with the fetcher, `source/`.
- sieb's answers through MCP, limited by the check token.
- Web pages from the allowed hosts and search results.
- Tags and metadata of public images through the two registry tools.

With stored credentials the workspace can hold private images and private source code. Everything
Claude reads is sent to Anthropic as part of the model requests.

Claude never receives a registry or git login, the worker secret, the fetcher secret or the local
secret. It has no access to a running container or to the cluster.

Claude writes one thing: a proposal through `propose_decision`. Its final reply is stored with
the check, cut to 4000 characters, and shown in sieb as untrusted plain text.

## Claude Code permissions

The checker runs the unmodified Claude Code binary non-interactively:

| Setting | Effect |
| --- | --- |
| `--tools Read,Grep,Glob,WebFetch,WebSearch` | Only these built-in tools exist. `Bash`, `Edit`, `Write` and subagents are absent |
| `--strict-mcp-config` | Only two MCP servers: sieb and the local inspect server |
| `--permission-mode dontAsk` with an allow list | Every call that is not allowed is denied, never prompted |
| `--max-turns` | The turn limit of the claim |
| `--disable-slash-commands`, `--no-session-persistence` | No commands, no stored transcript |

The allow list holds the sieb tools, the inspect tools, `WebFetch(domain:<host>)` for each
[allowed host](#web-access) and `WebSearch`. The deny list repeats `Bash`, `Edit`, `Write` and
`NotebookEdit`.

File tools are confined to the workspace (`blockReadsOutsideWorkingDirectories`,
`blockWritesOutsideWorkingDirectories`). Read deny rules also cover `/proc`, `/sys`, `/dev`,
`/run`, `/var/run`, `/etc`, `/home`, `/root`, `/tmp`, the MCP config, the settings file and, with
a shared workspace, the checker's whole private check directory. Hooks, bundled skills and auto
memory are off, and the bypass permission mode is disabled.

There is no shell, for three reasons. A shell would give a steered Claude every program in the
worker image, `/proc` with the memory of the processes that hold the Claude credential, and the
MCP config with the check token. Claude Code's Bash rules match command text and are no security
boundary, and its built-in read-only commands such as `cat` or `find` cannot be switched off.
Isolating Bash needs bubblewrap and unprivileged user namespaces, which container runtimes block
under their default seccomp profile. The few binary tools a triage needs run behind the inspect
server instead, which checks every argument.

## Web access

WebFetch reaches only the hosts of `SIEB_CHECKER_WEB_DOMAINS`. A rule matches its host only.
`*.example.org` matches every subdomain but not `example.org` itself. Setting the variable
replaces the default list:

| Purpose | Hosts |
| --- | --- |
| CVE databases and advisories | `nvd.nist.gov`, `services.nvd.nist.gov`, `cve.org`, `www.cve.org`, `cveawg.mitre.org`, `www.cisa.gov`, `osv.dev`, `api.osv.dev`, `advisories.gitlab.com`, `rustsec.org`, `api.first.org` (EPSS) |
| Source hosting | `github.com`, `api.github.com`, `raw.githubusercontent.com`, `gitlab.com` |
| Upstream advisories | `openssl-library.org`, `curl.se`, `nginx.org`, `nodejs.org` |
| Platform releases | `update.k3s.io`, `docs.k3s.io` |
| Go | `pkg.go.dev`, `go.dev`, `proxy.golang.org`, `vuln.go.dev` |
| Distro trackers | `security-tracker.debian.org`, `tracker.debian.org`, `packages.debian.org`, `sources.debian.org`, `salsa.debian.org`, `ubuntu.com`, `launchpad.net`, `packages.ubuntu.com`, `security.alpinelinux.org`, `secdb.alpinelinux.org`, `pkgs.alpinelinux.org`, `gitlab.alpinelinux.org`, `access.redhat.com`, `bugzilla.redhat.com`, `www.suse.com`, `lists.suse.com`, `bugzilla.suse.com`, `bodhi.fedoraproject.org`, `alas.aws.amazon.com`, `linux.oracle.com`, `errata.almalinux.org`, `errata.rockylinux.org`, `packages.wolfi.dev` |
| Package registries | `www.npmjs.com`, `registry.npmjs.org`, `pypi.org`, `crates.io`, `rubygems.org`, `central.sonatype.com`, `repo1.maven.org`, `search.maven.org`, `www.nuget.org`, `api.nuget.org`, `packagist.org` |
| Image registries | `hub.docker.com`, `quay.io`, `ghcr.io` |

Claude Code also lets WebFetch reach a built-in set of preapproved documentation hosts without a
rule. WebSearch stays on. It runs on Anthropic's side and returns results, which Claude can then
only open on the hosts above.

The list narrows exfiltration, it does not close it. A steered Claude can put what it read into
the path or query of a request to an allowed host, for example a GitHub URL, and whoever operates
that host or controls content there may see it. It can also put text into search queries. What it
can read is the workspace, the prompt and sieb's answers for the finding of the check. With
stored credentials the workspace includes private images and private source code. Shorten the
list to tighten this, for example to the hosts of your own distro and ecosystems.

The list is a rule inside Claude Code, not a network boundary. The
[NetworkPolicy](../auto-check.md#set-it-up) is the boundary, and it is required.

## Inspect tools

The inspect server is a stdio MCP server shipped in the worker image. Claude Code starts it for
each check with the workspace as its only argument and `PATH` as its only configured variable. It
inherits Claude's environment on top, without the Claude credential. Its tools are read-only and
named `mcp__inspect__<tool>`:

| Tool | Arguments | Runs |
| --- | --- | --- |
| `strings` | `path`, `minLength` (3 to 64, default 6), `pattern`, `regex`, `ignoreCase` | `strings -a -n <minLength>` |
| `readelf` | `path`, `mode`, and the same filter | `readelf` with the fixed flags of the mode, wide output |
| `objdump` | `path`, `mode`, `symbol`, and the same filter | `objdump -p`, `-h -w` or `-d --no-show-raw-insn --disassemble=<symbol>` |
| `unzip_list` | `path` | `unzip -l`, lists without extracting |
| `jq` | `path` of a `.json` file up to 64 MiB, `filter` up to 500 characters | `jq -M -- <filter> <path>` |
| `registry_tags` | `repository` without tag or digest, `prefix`, `limit` (1 to 500, default 100) | `crane ls --omit-digest-tags` |
| `registry_image` | `ref` with tag or digest, `platform` (default `linux/amd64`) | `crane digest`, `crane manifest`, `crane config` |

The `readelf` modes are `header`, `sections`, `segments`, `dynamic`, `symbols`,
`dynamic_symbols`, `notes` and `versions`. The `objdump` modes are `private_headers`,
`section_headers` and `disassemble_symbol`.

Rules for the file tools:

- A path is resolved with all symlinks followed and must be a regular file inside the workspace.
  Absolute paths outside it, `..` and symlinks that lead outside are refused.
- Commands run without a shell, with `PATH` as their whole environment, the workspace as working
  directory, a 30 second timeout and 64 KiB of output. Output over the cap is cut with a note.
  Only the tail of stderr is kept, so a failing command still reports its exit code.
- A `pattern` (plain text, or an extended regular expression with `regex`) filters lines before
  the cap. The filter reads at most 32 MiB of tool output and says so when later matches are
  missing.
- A symbol for `disassemble_symbol` holds letters, digits and `_ . $ @` only.
- A jq filter must not use `import`, `include`, `env`, `$ENV`, `input_filename` or the module
  search builtins.
- objdump disassembles only code of the worker's own architecture. readelf, strings and the
  other tools read any architecture.

Rules for the two registry tools, which let Claude see whether a base or upstream image tag was
rebuilt after a fix:

- They read anonymously. crane gets `PATH` and a `DOCKER_CONFIG` that does not exist as its whole
  environment, so it never finds a login.
- The registry must be on the default list of public registries: `docker.io` and its aliases,
  `mirror.gcr.io`, `ghcr.io`, `quay.io`, `registry.k8s.io`, `gcr.io`, `public.ecr.aws`,
  `mcr.microsoft.com` and `cgr.dev`. A reference without a registry means Docker Hub. The list
  keeps the tools from becoming a channel to an arbitrary host.
- A reference is lower case, at most 300 characters, without option syntax, port or IP address.
- Each crane call gets the 30 second timeout. The tag listing reads at most 4 MiB, the manifest
  256 KiB and the config 1 MiB. `registry_image` answers JSON with the digest, the platforms,
  the creation time, the labels and up to 60 history steps.

Go build information needs no tool of its own: syft records the Go modules of binaries in
`inventory.json`.

## Known limits

Exfiltration through allowed channels. WebFetch to an allowed host and WebSearch can carry what
Claude read, see [Web access](#web-access). With stored credentials that includes private images
and source code.

Same user within a container. In the checker, the worker process, Claude Code, the inspect server
and every inspect tool run as one user. Code execution in any of them, for example through a
memory corruption bug in readelf, objdump, unzip or jq triggered by a crafted image file, can
read the memory of the others and so the worker secret, the local secret, the Claude credential
and the check token. In the single-container layout crane, tar and syft run there too.

Parsers next to the logins. In the fetcher, crane, GNU tar, syft and git parse untrusted content
under the user that holds the logins of the check. syft runs after the docker config is gone, but
an exploit in one of these tools could still read a login from the fetcher's memory or from the
environment of a running `git fetch`.

The source may not match the image. Without a revision label or a matching git tag the checkout
is the default branch. The prompt and the Checks page say which one was used.

One platform. A multi-platform image is exported for `SIEB_CHECKER_PLATFORM` only.

What contains the rest is the pod specification: no service account token, a read-only root
filesystem, size limits on the volumes, no capabilities, the default seccomp profile and the
NetworkPolicy that closes private addresses and the cloud metadata endpoint. Keep the worker
image current so the parsers get their fixes. And a proposal changes nothing until a person
accepts it in sieb.

## Worker image

`ghcr.io/bernhardkelm/sieb-checker` is built from `Dockerfile.checker` with the same tags and
platforms (`linux/amd64`, `linux/arm64`) as the main image. It contains:

- Node from the `node:<version>-alpine` base image, pinned by its index digest (`NODE_IMAGE`).
- The worker source with all of `src/core`, plus the MCP server SDK and zod for the inspect
  server.
- Claude Code, the native binary of `@anthropic-ai/claude-code-linux-<arch>-musl`, taken from
  its npm tarball after checking the registry's sha512 `dist.integrity`
  (`CLAUDE_CODE_VERSION`, `CLAUDE_CODE_INTEGRITY_AMD64`, `CLAUDE_CODE_INTEGRITY_ARM64`). No
  install script runs.
- crane and syft as release binaries, checked against pinned sha256 sums (`CRANE_VERSION`,
  `SYFT_VERSION`).
- From Alpine, pinned to their upstream version in a way that admits Alpine's security rebuilds:
  `binutils`, `jq` and `unzip` behind the inspect tools, GNU `tar`, `git` for the fetcher,
  `bash`, which Claude Code requires on Alpine, `file`, and `tini` as init.

The entrypoint is `tini -- node` with `src/checker/main.ts` as the default command. tini forwards
SIGTERM and reaps the processes of killed process groups. The image runs as the non-root user
`node` (uid 1000), the fetcher under the uid the pod gives it, and writes only below `/work` and
`/shared`.

CI runs the image once before publishing it. It must refuse to start without `SIEB_WORKER_URL`
as checker and as fetcher, print the git and Claude Code versions and answer `tools/list` on the
inspect server. Updating Claude Code is described in the
[contributor guide](../../CONTRIBUTING.md).
