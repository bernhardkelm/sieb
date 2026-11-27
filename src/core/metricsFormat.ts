export type MetricType = 'gauge' | 'counter' | 'summary'

/**
 * Escapes a label value for the Prometheus text format: backslash, double quote and newline.
 * @param {string} value - Raw label value
 * @returns {string} - Escaped value without surrounding quotes
 */
export const escapeLabelValue = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')

/**
 * Renders the HELP and TYPE lines of a metric family.
 * @param {string} name - Family name, a counter's with its _total suffix
 * @param {MetricType} type - Metric type
 * @param {string} help - Help text without backslashes or newlines
 * @returns {string[]} - Two comment lines
 */
export const metricHeader = (name: string, type: MetricType, help: string): string[] => [
  `# HELP ${name} ${help}`,
  `# TYPE ${name} ${type}`,
]

/**
 * Renders one sample line.
 * @param {string} name - Sample name
 * @param {Record<string, string>} labels - Label names and raw values
 * @param {number} value - Sample value
 * @returns {string} - Sample line
 */
export const sample = (name: string, labels: Record<string, string>, value: number): string => {
  const pairs = Object.entries(labels).map(([key, raw]) => `${key}="${escapeLabelValue(raw)}"`)

  return `${name}${pairs.length > 0 ? `{${pairs.join(',')}}` : ''} ${value}`
}
