import type { CheckView, ChecksResponse } from '#core/check.ts'

/**
 * Builds a check with neutral defaults, queued at position 1 for finding 1.
 * @param {Partial<CheckView>} overrides - Fields to set
 * @returns {CheckView} - Check
 */
export const buildCheck = (overrides: Partial<CheckView> = {}): CheckView => ({
  id: 1,
  findingId: 1,
  vulnId: 'CVE-2099-10001',
  imageRef: 'index.docker.io/library/nginx',
  requestedBy: 'alice',
  state: 'queued',
  phase: null,
  position: 1,
  createdAt: '2026-06-01T11:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  error: null,
  proposalId: null,
  usage: null,
  reply: null,
  ...overrides,
})

/**
 * Builds a checks answer, enabled with the worker online and nothing open by default.
 * @param {Partial<ChecksResponse>} overrides - Fields to set
 * @returns {ChecksResponse} - Answer
 */
export const buildChecksResponse = (overrides: Partial<ChecksResponse> = {}): ChecksResponse => ({
  enabled: true,
  workerOnline: true,
  running: null,
  queued: [],
  recent: [],
  ...overrides,
})
