export interface SparkPoint {
  time: number // epoch ms
  value: number
}

/** Drawing box in viewBox units, inset keeps the stroke and end dot off the top and bottom edge */
export interface SparkBox {
  width: number
  height: number
  inset: number
}

export interface SparklineGeometry {
  line: string // path of the trend line
  area: string // closed path of the wash below the line
  end: { xPercent: number; yPercent: number } // last point relative to the box, for the end dot
}

export const SPARK_BOX: SparkBox = { width: 100, height: 24, inset: 3 }

const MIN_EXTENT_SHARE = 0.2 // of the largest value
const MIN_EXTENT = 2

/**
 * Returns the value domain of a sparkline: the smallest and largest value, widened around their
 * middle to a minimum extent (never below zero), so a change of one does not fill the height.
 * @param {readonly number[]} values - Values, at least one
 * @returns {[number, number]} - Lower and upper bound
 */
export const sparkValueDomain = (values: readonly number[]): [number, number] => {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const extent = Math.max(hi * MIN_EXTENT_SHARE, MIN_EXTENT)

  if (hi - lo >= extent) {
    return [lo, hi]
  }

  const lower = Math.max(0, (lo + hi) / 2 - extent / 2)

  return [lower, lower + extent]
}

/**
 * Rounds a coordinate to two decimals for compact path data.
 * @param {number} value - Coordinate
 * @returns {number} - Rounded coordinate
 */
const round = (value: number): number => Math.round(value * 100) / 100

/**
 * Maps a value of a domain linearly onto a range; a domain without extent maps to the middle.
 * @param {number} value - Value inside the domain
 * @param {[number, number]} domain - Smallest and largest value
 * @param {[number, number]} range - Output for the smallest and the largest value
 * @returns {number} - Mapped value
 */
export const scaleLinear = (
  value: number,
  domain: [number, number],
  range: [number, number],
): number => {
  const [d0, d1] = domain
  const [r0, r1] = range

  if (d1 === d0) {
    return (r0 + r1) / 2
  }

  return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0)
}

/**
 * Computes the sparkline of a series: x by time across the whole box, y scaled to the value
 * domain inside the vertical inset.
 * @param {readonly SparkPoint[]} points - Points, oldest first
 * @param {SparkBox} box - Drawing box
 * @returns {SparklineGeometry | null} - Paths and end point, null below two points
 */
export const sparklineGeometry = (
  points: readonly SparkPoint[],
  box: SparkBox = SPARK_BOX,
): SparklineGeometry | null => {
  if (points.length < 2) {
    return null
  }

  const times = points.map((point) => point.time)
  const timeDomain: [number, number] = [Math.min(...times), Math.max(...times)]
  const valueDomain = sparkValueDomain(points.map((point) => point.value))
  const bottom = box.height - box.inset
  const coordinates = points.map((point) => ({
    x: round(scaleLinear(point.time, timeDomain, [0, box.width])),
    y: round(scaleLinear(point.value, valueDomain, [bottom, box.inset])),
  }))
  const line = coordinates.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')
  const first = coordinates[0]!
  const last = coordinates[coordinates.length - 1]!

  return {
    line,
    area: `${line} L${last.x} ${box.height} L${first.x} ${box.height} Z`,
    end: {
      xPercent: round((last.x / box.width) * 100),
      yPercent: round((last.y / box.height) * 100),
    },
  }
}
