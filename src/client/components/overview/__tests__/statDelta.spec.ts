import { describe, expect, it } from 'vitest'

import { deltaTone, describeTrend, formatDelta } from '@/components/overview/statDelta'
import { formatCount } from '@/format/count'

describe('formatCount', () => {
  it('groups below ten thousand and compacts above', () => {
    expect(formatCount(1284)).toBe('1,284')
    expect(formatCount(12_940)).toBe('12.9K')
  })
})

describe('formatDelta', () => {
  it('signs changes with plus, a true minus and plus-minus for none', () => {
    expect(formatDelta(12)).toBe('+12')
    expect(formatDelta(-73)).toBe('−73')
    expect(formatDelta(0)).toBe('±0')
    expect(formatDelta(-1500)).toBe('−1,500')
  })
})

describe('deltaTone', () => {
  it('reads fewer as good and more as bad where fewer is better', () => {
    expect(deltaTone(-3, 'fewer-is-better')).toBe('good')
    expect(deltaTone(3, 'fewer-is-better')).toBe('bad')
    expect(deltaTone(0, 'fewer-is-better')).toBe('neutral')
  })

  it('keeps neutral panels neutral', () => {
    expect(deltaTone(-3, 'neutral')).toBe('neutral')
    expect(deltaTone(3, 'neutral')).toBe('neutral')
  })
})

describe('describeTrend', () => {
  it('describes direction, amount and both ends', () => {
    expect(describeTrend(1284, 1211, '30 days')).toBe('down 73 over 30 days, from 1,284 to 1,211')
    expect(describeTrend(2, 5, '7 days')).toBe('up 3 over 7 days, from 2 to 5')
  })

  it('describes an unchanged value', () => {
    expect(describeTrend(4, 4, '90 days')).toBe('unchanged at 4 over 90 days')
  })
})
