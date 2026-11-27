import { describe, expect, it } from 'vitest'

import type { CheckUsageWindow } from '#core/check.ts'
import { checkUsageRows } from '@/format/checkUsageText'

const EMPTY: CheckUsageWindow = {
  days: 7,
  checks: 0,
  withUsage: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheTokens: 0,
  costUsd: null,
  averageDurationMs: null,
}

describe('checkUsageRows', () => {
  it('formats counts compactly, a small cost with four decimals and missing values plainly', () => {
    const rows = checkUsageRows({
      last7Days: EMPTY,
      last30Days: {
        ...EMPTY,
        days: 30,
        checks: 3,
        inputTokens: 1_234,
        outputTokens: 56_789,
        costUsd: 0.004,
        averageDurationMs: 42_000,
      },
    })

    expect(Object.fromEntries(rows.map((row) => [row.label, row.values]))).toEqual({
      Checks: ['0', '3'],
      'Input tokens': ['0', '1,234'],
      'Output tokens': ['0', '56.8K'],
      'Cache tokens': ['0', '0'],
      'Cost, API-equivalent estimate': ['not reported', '$0.0040'],
      'Average duration': ['none', '42s'],
    })
  })
})
