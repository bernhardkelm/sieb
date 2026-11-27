import { writeFileSync } from 'node:fs'

import type { CdpClient } from '#scripts/screenshots/chrome/cdpClient.ts'
import { element, type ElementMatch } from '#scripts/screenshots/chrome/elementQuery.ts'
import { createEmulation, type ApplyEmulation } from '#scripts/screenshots/chrome/pageEmulation.ts'
import { pollFor, sleep } from '#scripts/screenshots/processes.ts'

export interface PageDriver {
  configure: ApplyEmulation
  open: (url: string) => Promise<void>
  evaluate: <T>(expression: string) => Promise<T>
  waitFor: (expression: string, what: string) => Promise<void>
  click: (selector: string, match?: ElementMatch) => Promise<void>
  type: (selector: string, text: string) => Promise<void>
  scrollTo: (selector: string, match?: ElementMatch, block?: 'start' | 'center') => Promise<void>
  blur: () => Promise<void> // drops the focus, so no focus ring shows
  settle: () => Promise<void>
  capture: (file: string, clipSelector?: string) => Promise<void>
}

const QUIET_MS = 600
const SETTLE_TIMEOUT_MS = 15_000
const WAIT_TIMEOUT_MS = 10_000

/**
 * Wraps a DevTools page with the actions the screenshots need: emulation, navigation that waits
 * for network idle, real mouse clicks (Reka menus open on pointer down), typing, scrolling and PNG
 * capture. The pointer rests in the top left corner after a click, so no row keeps a hover. Leave-page prompts of unsaved
 * drafts are accepted, so a filled form never blocks the next navigation.
 * @param {CdpClient} page - Page client
 * @returns {Promise<PageDriver>} - Driver
 */
export const createPageDriver = async (page: CdpClient): Promise<PageDriver> => {
  let inflight = 0
  let lastActivity = Date.now()

  page.onEvent(({ method }) => {
    if (method === 'Page.javascriptDialogOpening') {
      void page.send('Page.handleJavaScriptDialog', { accept: true })
      return
    }

    if (method === 'Network.requestWillBeSent') {
      inflight += 1
    } else if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
      inflight = Math.max(0, inflight - 1)
    } else {
      return
    }

    lastActivity = Date.now()
  })
  await page.send('Network.enable')
  await page.send('Page.enable')
  await page.send('Runtime.enable')

  const configure = await createEmulation(page)

  /**
   * Evaluates an expression in the page and returns its value.
   * @param {string} expression - JavaScript expression, may return a promise
   * @returns {Promise<T>} - Value
   */
  const evaluate = async <T>(expression: string): Promise<T> => {
    const { result, exceptionDetails } = await page.send<{
      result: { value?: unknown }
      exceptionDetails?: { text: string; exception?: { description?: string } }
    }>('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })

    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    }

    return result.value as T
  }

  /**
   * Waits until no request is in flight for a moment and the web fonts are loaded.
   * @returns {Promise<void>} - Resolves once the page is idle
   */
  const settle = async (): Promise<void> => {
    await pollFor(
      async () => (inflight === 0 && Date.now() - lastActivity > QUIET_MS ? true : null),
      SETTLE_TIMEOUT_MS,
      'network idle',
    )
    await evaluate('document.fonts.ready.then(() => true)')
    await sleep(300)
  }

  /**
   * Waits until an expression is truthy in the page.
   * @param {string} expression - JavaScript expression
   * @param {string} what - Description for the timeout error
   * @returns {Promise<void>} - Resolves once it is truthy
   */
  const waitFor = async (expression: string, what: string): Promise<void> => {
    await pollFor(
      async () => ((await evaluate<boolean>(`!!(${expression})`)) ? true : null),
      WAIT_TIMEOUT_MS,
      what,
    )
  }

  return {
    configure,
    open: async (url) => {
      await page.send('Page.navigate', { url })
      await waitFor(`document.readyState === 'complete'`, `load of ${url}`)
      await settle()
    },
    evaluate,
    waitFor,
    click: async (selector, match) => {
      const target = element(selector, match)

      await waitFor(target, `${selector} ${JSON.stringify(match ?? {})}`)
      const { x, y } = await evaluate<{ x: number; y: number }>(
        `((el) => { el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })(${target})`,
      )

      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
      }

      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 })
      await settle()
    },
    type: async (selector, text) => {
      await waitFor(element(selector), selector)
      await evaluate(`${element(selector)}.focus()`)
      await page.send('Input.insertText', { text })
    },
    scrollTo: async (selector, match, block = 'start') => {
      const target = element(selector, match)

      await waitFor(target, selector)
      await evaluate(`${target}.scrollIntoView({ block: ${JSON.stringify(block)} })`)
      await settle()
    },
    blur: async () => {
      await evaluate(
        'document.activeElement instanceof HTMLElement && document.activeElement.blur()',
      )
    },
    settle,
    capture: async (file, clipSelector) => {
      const clip =
        clipSelector === undefined
          ? undefined
          : await evaluate<object>(
              `(({ x, y, width, height }) => ({ x, y, width, height, scale: 1 }))(${element(clipSelector)}.getBoundingClientRect())`,
            )
      const { data } = await page.send<{ data: string }>('Page.captureScreenshot', {
        format: 'png',
        ...(clip === undefined ? {} : { clip }),
      })

      writeFileSync(file, Buffer.from(data, 'base64'))
    },
  }
}
