/**
 * Thins a time series to at most maxPoints: splits [from, to] into maxPoints equal buckets and
 * keeps the latest point of each non-empty bucket. Points before from are dropped, points after
 * to fall into the last bucket. Input order does not matter, the result is oldest first.
 * @param {readonly T[]} points - Points with an ISO timestamp
 * @param {{ from: Date; to: Date }} window - Time window
 * @param {number} maxPoints - Bucket count, at least 1
 * @returns {T[]} - At most maxPoints points, oldest first
 */
export const downsampleLatest = <T extends { at: string }>(
  points: readonly T[],
  window: { from: Date; to: Date },
  maxPoints: number,
): T[] => {
  const from = window.from.getTime()
  const span = Math.max(window.to.getTime() - from, 1)
  const buckets = Math.max(Math.floor(maxPoints), 1)
  const latest = new Map<number, { time: number; point: T }>()

  for (const point of points) {
    const time = Date.parse(point.at)

    if (Number.isNaN(time) || time < from) {
      continue
    }

    const bucket = Math.min(Math.floor(((time - from) / span) * buckets), buckets - 1)
    const current = latest.get(bucket)

    if (!current || time >= current.time) {
      latest.set(bucket, { time, point })
    }
  }

  return [...latest.entries()].sort(([a], [b]) => a - b).map(([, entry]) => entry.point)
}
