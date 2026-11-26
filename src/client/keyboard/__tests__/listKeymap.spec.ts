import { describe, expect, it } from 'vitest'

import { listActionFor } from '@/keyboard/listKeymap'
import { findingIdOfRowKey, findingRowKey, groupOfRowKey, groupRowKey } from '@/keyboard/rowKey'

describe('listActionFor', () => {
  it('maps list keys on the page', () => {
    expect(listActionFor({ key: 'Enter' }, 'page')).toBe('activate')
    expect(listActionFor({ key: 'Escape' }, 'page')).toBe('close')
    expect(listActionFor({ key: 'ArrowRight' }, 'page')).toBe('expand')
    expect(listActionFor({ key: 'ArrowLeft' }, 'page')).toBe('collapse')
    expect(listActionFor({ key: 'j' }, 'page')).toBeNull()
    expect(listActionFor({ key: 'q' }, 'page')).toBeNull()
  })

  it('keeps only / inside the panel and nothing in overlays', () => {
    expect(listActionFor({ key: '/' }, 'panel')).toBe('search')
    expect(listActionFor({ key: 'Enter' }, 'panel')).toBeNull()
    expect(listActionFor({ key: 'ArrowLeft' }, 'panel')).toBeNull()
    expect(listActionFor({ key: '/' }, 'overlay')).toBeNull()
  })
})

describe('rowKey', () => {
  it('round-trips finding and group keys', () => {
    expect(findingIdOfRowKey(findingRowKey(42))).toBe(42)
    expect(groupOfRowKey(groupRowKey('index.docker.io/library/nginx'))).toBe(
      'index.docker.io/library/nginx',
    )
    expect(findingIdOfRowKey(groupRowKey('x'))).toBeNull()
    expect(groupOfRowKey(findingRowKey(1))).toBeNull()
    expect(groupOfRowKey(null)).toBeNull()
  })
})
