/** Optional server feature that items such as nav entries and hints depend on */
export type Feature = 'mcp' | 'checks'

/** Whether each optional feature is switched on for this sieb */
export type Features = Readonly<Record<Feature, boolean>>

export const NO_FEATURES: Features = { mcp: false, checks: false }

/**
 * Returns whether every feature an item requires is switched on.
 * @param {{ requires?: readonly Feature[] }} item - Item with its required features
 * @param {Features} features - Switched on features
 * @returns {boolean} - True when nothing is required or all of it is on
 */
export const isAvailable = (item: { requires?: readonly Feature[] }, features: Features): boolean =>
  (item.requires ?? []).every((feature) => features[feature])
