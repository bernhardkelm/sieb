import type { OverviewStats, SeverityCounts, StatsPoint } from '#core/overviewStats.ts'

export interface MockHistoryOptions {
  days: number
  stepHours: number
  seed: number
}

const DEFAULT_OPTIONS: MockHistoryOptions = { days: 30, stepHours: 2, seed: 0x5eb }

const HOUR_MS = 60 * 60 * 1000

const NOISE = 0.06 // relative noise amplitude of the oldest point, fading to zero at the end

const SEVERITY_START: Record<keyof SeverityCounts, number> = {
  critical: 1.6,
  high: 1.4,
  medium: 1.25,
  low: 1.15,
  unknown: 1,
}

/**
 * Creates a deterministic pseudo random generator (mulberry32).
 * @param {number} seed - Seed
 * @returns {() => number} - Generator of values in [-1, 1)
 */
const createNoise = (seed: number): (() => number) => {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value

    return (((value ^ (value >>> 14)) >>> 0) / 4_294_967_296) * 2 - 1
  }
}

/**
 * Interpolates linearly.
 * @param {number} from - Value at 0
 * @param {number} to - Value at 1
 * @param {number} t - Position in [0, 1]
 * @returns {number} - Interpolated value
 */
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

/**
 * Eases out, so triage progresses faster early on.
 * @param {number} t - Position in [0, 1]
 * @returns {number} - Eased position in [0, 1]
 */
const easeOut = (t: number): number => 1 - (1 - t) ** 2

/**
 * Builds the stats of one synthetic point. At t 1 every count equals the current one.
 * @param {OverviewStats} current - Current stats the history converges to
 * @param {number} t - Position from 0 (oldest) to 1 (current)
 * @param {() => number} noise - Noise generator
 * @returns {OverviewStats} - Synthetic stats, consistent with each other
 */
const syntheticStats = (current: OverviewStats, t: number, noise: () => number): OverviewStats => {
  /**
   * Returns a noise factor around 1 that fades out towards the current point.
   * @returns {number} - Factor
   */
  const jitter = (): number => 1 + noise() * NOISE * (1 - t)
  /**
   * Returns the share of a current count in the current open findings.
   * @param {number} count - Current count
   * @returns {number} - Share in [0, 1], 0 without open findings
   */
  const share = (count: number): number => (current.open > 0 ? count / current.open : 0)
  const bySeverity = { ...current.bySeverity }

  for (const key of Object.keys(SEVERITY_START) as (keyof SeverityCounts)[]) {
    bySeverity[key] = Math.max(
      0,
      Math.round(current.bySeverity[key] * lerp(SEVERITY_START[key], 1, t) * jitter()),
    )
  }

  const open = Object.values(bySeverity).reduce((total, count) => total + count, 0)
  const triaged = easeOut(t)
  const inboxShare = share(current.inbox)
  const inbox = Math.round(open * lerp(Math.max(inboxShare, 0.9), inboxShare, triaged))
  /**
   * Returns a decided count that grows with the triage progress towards its current value.
   * @param {number} count - Current count
   * @returns {number} - Count at this point
   */
  const decided = (count: number): number =>
    Math.round(open * lerp(share(count) * 0.2, share(count), triaged))
  const notAffected = Math.min(open - inbox, decided(current.notAffected))

  return {
    open,
    inbox,
    kev: Math.min(open, current.kev + (t < 0.55 ? 1 : 0)),
    public: Math.min(open, Math.round(open * share(current.public) * jitter())),
    bySeverity,
    notAffected,
    accepted: Math.min(open - inbox - notAffected, decided(current.accepted)),
    fixPlanned: Math.round(lerp(0, current.fixPlanned, triaged)),
    reopened: t >= 0.8 ? current.reopened : 0,
    activeDecisions: Math.round(
      lerp(current.activeDecisions * 0.2, current.activeDecisions, triaged),
    ),
    images: Math.min(open, current.images + Math.round(3 * (1 - t))),
  }
}

/**
 * Generates deterministic synthetic history ending one step before end: open findings slowly
 * decrease with noise, the inbox drains while decisions grow, and the newest point equals the
 * current stats.
 * @param {OverviewStats} current - Current stats the history converges to
 * @param {Date} end - Time after the newest point
 * @param {Partial<MockHistoryOptions>} options - Days of history, hours between points, seed
 * @returns {StatsPoint[]} - Points, oldest first
 */
export const generateMockStatsHistory = (
  current: OverviewStats,
  end: Date,
  options: Partial<MockHistoryOptions> = {},
): StatsPoint[] => {
  const { days, stepHours, seed } = { ...DEFAULT_OPTIONS, ...options }
  const count = Math.floor((days * 24) / stepHours)
  const noise = createNoise(seed)

  return Array.from({ length: count }, (_, index) => ({
    at: new Date(end.getTime() - (count - index) * stepHours * HOUR_MS).toISOString(),
    stats: syntheticStats(current, count > 1 ? index / (count - 1) : 1, noise),
  }))
}
