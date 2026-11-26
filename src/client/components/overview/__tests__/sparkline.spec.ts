import { describe, expect, it } from 'vitest'

import { scaleLinear, sparklineGeometry, sparkValueDomain } from '@/components/overview/sparkline'

const BOX = { width: 100, height: 24, inset: 4 }

describe('scaleLinear', () => {
  it('maps a domain onto a range, inverted ranges included', () => {
    expect(scaleLinear(5, [0, 10], [0, 100])).toBe(50)
    expect(scaleLinear(10, [0, 10], [20, 4])).toBe(4)
  })

  it('maps a domain without extent to the middle of the range', () => {
    expect(scaleLinear(7, [7, 7], [20, 4])).toBe(12)
  })
})

describe('sparkValueDomain', () => {
  it('keeps a domain that spans the minimum extent', () => {
    expect(sparkValueDomain([400, 300])).toEqual([300, 400])
  })

  it('widens a narrow domain around its middle so a change of one stays small', () => {
    expect(sparkValueDomain([35, 34])).toEqual([31, 38])
  })

  it('never widens below zero', () => {
    expect(sparkValueDomain([0, 0])).toEqual([0, 2])
  })
})

describe('sparklineGeometry', () => {
  it('returns null below two points', () => {
    expect(sparklineGeometry([], BOX)).toBeNull()
    expect(sparklineGeometry([{ time: 0, value: 3 }], BOX)).toBeNull()
  })

  it('spreads points by time and puts the largest value at the top inset', () => {
    const geometry = sparklineGeometry(
      [
        { time: 0, value: 10 },
        { time: 300, value: 0 },
        { time: 1000, value: 5 },
      ],
      BOX,
    )

    expect(geometry?.line).toBe('M0 4 L30 20 L100 12')
    expect(geometry?.area).toBe('M0 4 L30 20 L100 12 L100 24 L0 24 Z')
    expect(geometry?.end).toEqual({ xPercent: 100, yPercent: 50 })
  })

  it('draws a flat series through the middle', () => {
    const geometry = sparklineGeometry(
      [
        { time: 0, value: 4 },
        { time: 10, value: 4 },
      ],
      BOX,
    )

    expect(geometry?.line).toBe('M0 12 L100 12')
  })

  it('orders nothing itself and rounds coordinates to two decimals', () => {
    const geometry = sparklineGeometry(
      [
        { time: 0, value: 0 },
        { time: 1, value: 1 },
        { time: 3, value: 2 },
      ],
      BOX,
    )

    expect(geometry?.line).toBe('M0 20 L33.33 12 L100 4')
  })
})
