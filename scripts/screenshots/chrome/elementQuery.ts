/** Narrows a selector to the element whose text contains `text`, or to the `index`th match */
export interface ElementMatch {
  text?: string
  index?: number
}

/**
 * Returns the page expression that selects an element by CSS selector, text and position.
 * @param {string} selector - CSS selector
 * @param {ElementMatch} [match] - Text the element contains and index among the matches
 * @returns {string} - JavaScript expression, undefined in the page when nothing matches
 */
export const element = (selector: string, { text, index = 0 }: ElementMatch = {}): string =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})]` +
  `.filter((el) => el.textContent.includes(${JSON.stringify(text ?? '')}))[${index}]`
