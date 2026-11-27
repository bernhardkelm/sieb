/**
 * Returns the text of an element without its hidden children, such as the reason a blocked
 * button points aria-describedby at.
 * @param {Element} element - Element
 * @returns {string} - Visible text, trimmed
 */
export const visibleText = (element: Element): string =>
  [...element.childNodes]
    .filter(
      (node) => node.nodeType === Node.TEXT_NODE || (node instanceof HTMLElement && !node.hidden),
    )
    .map((node) => node.textContent)
    .join('')
    .trim()
