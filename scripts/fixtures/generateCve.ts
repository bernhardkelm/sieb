import { severityFromScore, type Severity } from '#core/severity.ts'
import type { FixtureCve } from '#scripts/fixtures/fixtureModel.ts'
import type { Random } from '#scripts/fixtures/random.ts'

const VENDOR_SEVERITIES: readonly Severity[] = [
  'Critical',
  'High',
  'High',
  'Medium',
  'Medium',
  'Low',
]

/**
 * Generates a CVE with a plausible id, score and severity. A fifth has no score, half of those
 * stay Unknown; of the scored ones most are re-rated from the score.
 * @param {Random} random - Generator
 * @param {string} family - CVE family id
 * @param {string} title - Title
 * @param {Set<string>} used - Ids taken so far, extended
 * @returns {FixtureCve} - CVE
 */
export const generateCve = (
  random: Random,
  family: string,
  title: string,
  used: Set<string>,
): FixtureCve => {
  let id = ''

  while (id === '' || used.has(id)) {
    id = `CVE-${random.pick([2023, 2024, 2024, 2025, 2025, 2026])}-${random.int(1000, 59999)}`
  }

  used.add(id)

  const score = random.chance(0.2) ? null : Math.round(random.int(20, 98)) / 10
  const rerated = score !== null && random.chance(0.6)
  const severity: Severity = rerated
    ? severityFromScore(score)
    : score === null && random.chance(0.5)
      ? 'Unknown'
      : random.pick(VENDOR_SEVERITIES)

  return {
    id,
    family,
    title,
    score,
    severity,
    severitySource: rerated ? 'cvss' : null,
    trivySeverity: random.chance(0.85) ? 'UNKNOWN' : severity.toUpperCase(),
    publishedDate: `2026-${String(random.int(1, 10)).padStart(2, '0')}-${String(random.int(10, 28))}T${String(random.int(10, 23))}:17:24Z`,
  }
}
