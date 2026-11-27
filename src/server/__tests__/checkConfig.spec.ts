// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { readConfig } from '#server/config.ts'

const CWD = '/srv/sieb'
const SECRET = 'a'.repeat(32)
const ON = {
  SIEB_CHECKS_ENABLED: 'true',
  SIEB_MCP_ENABLED: 'true',
  SIEB_PUBLIC_URL: 'http://localhost:5173',
  SIEB_WORKER_PORT: '9300',
  SIEB_WORKER_SECRET: SECRET,
}

describe('Auto-check config', () => {
  it('is off by default', () => {
    expect(readConfig({}, CWD).checks).toBeNull()
    expect(readConfig({ ...ON, SIEB_CHECKS_ENABLED: 'false' }, CWD).checks).toBeNull()
  })

  it('reads the worker settings with the default timeout and turns', () => {
    expect(readConfig(ON, CWD).checks).toEqual({
      workerPort: 9300,
      workerSecret: SECRET,
      timeoutSeconds: 1200,
      maxTurns: 60,
    })
    expect(
      readConfig({ ...ON, SIEB_CHECK_TIMEOUT_SECONDS: '600', SIEB_CHECK_MAX_TURNS: '25' }, CWD)
        .checks,
    ).toMatchObject({ timeoutSeconds: 600, maxTurns: 25 })
  })

  it('needs MCP and the public URL', () => {
    expect(() => readConfig({ ...ON, SIEB_MCP_ENABLED: 'false' }, CWD)).toThrow(/SIEB_MCP_ENABLED/)
    expect(() => readConfig({ ...ON, SIEB_PUBLIC_URL: '' }, CWD)).toThrow(/SIEB_PUBLIC_URL/)
  })

  it('needs a worker port apart from the main and metrics ports', () => {
    expect(() => readConfig({ ...ON, SIEB_WORKER_PORT: '' }, CWD)).toThrow(/SIEB_WORKER_PORT/)
    expect(() => readConfig({ ...ON, SIEB_WORKER_PORT: '3100' }, CWD)).toThrow(/differ/)
    expect(() => readConfig({ ...ON, SIEB_METRICS_PORT: '9300' }, CWD)).toThrow(/differ/)
    expect(() => readConfig({ ...ON, SIEB_WORKER_PORT: '70000' }, CWD)).toThrow(/SIEB_WORKER_PORT/)
  })

  it('needs a worker secret of at least 32 characters and never echoes it', () => {
    const short = 'b'.repeat(31)

    expect(() => readConfig({ ...ON, SIEB_WORKER_SECRET: undefined }, CWD)).toThrow(/32/)
    expect(() => readConfig({ ...ON, SIEB_WORKER_SECRET: short }, CWD)).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(short) }),
    )
    expect(() => readConfig({ ...ON, SIEB_WORKER_SECRET: `${SECRET} x` }, CWD)).toThrow(
      /whitespace/,
    )
  })

  it('refuses invalid timeouts and turn limits', () => {
    expect(() => readConfig({ ...ON, SIEB_CHECK_TIMEOUT_SECONDS: '0' }, CWD)).toThrow(
      /SIEB_CHECK_TIMEOUT_SECONDS/,
    )
    expect(() => readConfig({ ...ON, SIEB_CHECK_MAX_TURNS: 'many' }, CWD)).toThrow(
      /SIEB_CHECK_MAX_TURNS/,
    )
  })
})
