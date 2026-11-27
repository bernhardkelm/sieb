// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { CLAIM, PULLED, testConfig } from '#checker/__tests__/checkFixtures.ts'
import { claudeArgs, claudeEnv, mcpConfig } from '#checker/claude/claudeInvocation.ts'
import { claudeSettings } from '#checker/claude/claudeSettings.ts'
import { workspacePrompt } from '#checker/claude/workspacePrompt.ts'
import { checkLayout } from '#checker/workspace/checkLayout.ts'

const config = testConfig('/work')
const layout = checkLayout('/work', 7)
const domains = config.webDomains

describe('claude invocation', () => {
  it('builds the documented headless command with the prompt first', () => {
    expect(claudeArgs('Investigate', layout, 40, domains)).toEqual([
      '-p',
      'Investigate',
      '--output-format',
      'json',
      '--mcp-config',
      '/work/check-7/mcp.json',
      '--strict-mcp-config',
      '--max-turns',
      '40',
      '--settings',
      '/work/check-7/settings.json',
      '--permission-mode',
      'dontAsk',
      '--tools',
      'Read,Grep,Glob,WebFetch,WebSearch',
      '--allowedTools',
      'mcp__sieb__*,mcp__inspect__*,WebFetch(domain:nvd.nist.gov),WebFetch(domain:*.github.com),WebSearch',
      '--disable-slash-commands',
      '--no-session-persistence',
    ])
    expect(claudeArgs('- bullet', layout, 1, domains)[1]).toBe('\n- bullet')
  })

  it('passes PATH, the check HOME, TMPDIR, the quiet variables and the credential descriptor', () => {
    const env = claudeEnv('oauth_token', config.path, layout)

    expect(env).toMatchObject({
      PATH: '/usr/bin:/bin',
      HOME: '/work/check-7/home',
      TMPDIR: '/work/check-7/tmp',
      CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR: '3',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      DISABLE_TELEMETRY: '1',
    })
    expect(Object.keys(env).filter((key) => !/^(CLAUDE_CODE_|DISABLE_|ENABLE_)/.test(key))).toEqual(
      ['PATH', 'HOME', 'TMPDIR'],
    )
    expect(Object.keys(env)).not.toContain('CLAUDE_CODE_OAUTH_TOKEN')
    expect(Object.keys(env)).not.toContain('ANTHROPIC_API_KEY')
    expect(claudeEnv('api_key', config.path, layout)).toMatchObject({
      CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR: '3',
    })
    expect(Object.keys(claudeEnv('api_key', config.path, layout))).not.toContain(
      'CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR',
    )
  })

  it('never puts a secret or the sieb token on the command line or into the env', () => {
    const exposed = JSON.stringify([
      claudeArgs(workspacePrompt(CLAIM, config.platform, PULLED), layout, 40, domains),
      claudeEnv(config.credential.kind, config.path, layout),
      claudeSettings(layout, domains),
    ])

    expect(exposed).not.toContain(config.workerSecret)
    expect(exposed).not.toContain(config.credential.value)
    expect(exposed).not.toContain(CLAIM.token)
    expect(JSON.stringify(mcpConfig(CLAIM, layout, config.path))).not.toContain(config.workerSecret)
  })

  it('connects sieb with the check token and the inspect server with PATH only', () => {
    expect(mcpConfig(CLAIM, layout, config.path)).toEqual({
      mcpServers: {
        sieb: {
          type: 'http',
          url: 'https://sieb.example.com/mcp',
          headers: { Authorization: 'Bearer sieb_check_token' },
        },
        inspect: {
          type: 'stdio',
          command: process.execPath,
          args: [
            expect.stringMatching(/src\/checker\/inspect\/inspectMain\.ts$/),
            '/work/check-7/workspace',
          ],
          env: { PATH: '/usr/bin:/bin' },
        },
      },
    })
  })

  it('allows only MCP tools, WebSearch and WebFetch on the allowed hosts, and no shell', () => {
    const settings = claudeSettings(layout, domains) as { permissions: Record<string, unknown> }
    const { allow, deny, ...mode } = settings.permissions as Record<string, string[]>

    expect(mode).toEqual({
      defaultMode: 'dontAsk',
      disableBypassPermissionsMode: 'disable',
      blockReadsOutsideWorkingDirectories: true,
      blockWritesOutsideWorkingDirectories: true,
    })
    expect(allow).toEqual([
      'mcp__sieb__*',
      'mcp__inspect__*',
      'WebFetch(domain:nvd.nist.gov)',
      'WebFetch(domain:*.github.com)',
      'WebSearch',
    ])
    expect(allow).not.toContain('WebFetch')
    expect(deny).toEqual(
      expect.arrayContaining([
        'Bash',
        'Edit',
        'Write',
        'Read(//proc/**)',
        'Read(//sys/**)',
        'Read(//var/run/**)',
        'Read(//etc/**)',
        'Read(//home/**)',
        'Read(//work/check-7/mcp.json)',
      ]),
    )
    expect(claudeArgs('x', layout, 1, domains).join(' ')).not.toMatch(/Bash/)
  })

  it('appends the workspace description and the pulled digest to the sieb prompt', () => {
    const prompt = workspacePrompt(CLAIM, 'linux/amd64', PULLED)

    expect(prompt.startsWith(CLAIM.prompt)).toBe(true)
    expect(prompt).toContain('image/: the flattened filesystem of the image (linux/amd64)')
    expect(prompt).toContain(
      `The worker pulled ${PULLED.ref}, the digest docker.io/library/nginx:1.27 pointed to at check time. The digest of the scanned image is unknown`,
    )
    expect(workspacePrompt(CLAIM, 'linux/amd64', { ...PULLED, scanned: true })).toContain(
      `The worker pulled ${PULLED.ref}, the digest of the scanned image.`,
    )
    expect(prompt).toContain('name own_source and runtime under Not checked')
    expect(prompt).toContain('There is no shell.')
    expect(prompt).toContain('the inspect tools (strings, readelf, objdump, unzip_list, jq)')
    expect(prompt).toContain(
      'File the verdict with propose_decision, then reply in the sieb format.',
    )
  })
})
