import { describe, expect, it } from 'vitest'

import { testFailureText } from '@/format/accessText'

describe('testFailureText', () => {
  it('explains a refused private address and keeps other reasons', () => {
    expect(testFailureText('address not allowed')).toBe(
      'address not allowed. sieb does not test hosts on private or in-cluster addresses; the fetcher can still use them.',
    )
    expect(testFailureText('HTTP 401')).toBe('HTTP 401')
  })
})
