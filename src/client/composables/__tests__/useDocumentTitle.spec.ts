import { describe, expect, it } from 'vitest'

import { documentTitle } from '@/composables/useDocumentTitle'

describe('documentTitle', () => {
  it('prefixes the open Inbox count only when something waits', () => {
    expect(documentTitle('Triage', 3)).toBe('(3) Triage · sieb')
    expect(documentTitle('Triage', 0)).toBe('Triage · sieb')
  })

  it('falls back to the app name without a view title', () => {
    expect(documentTitle(undefined, 0)).toBe('sieb')
    expect(documentTitle(undefined, 2)).toBe('(2) sieb')
  })
})
