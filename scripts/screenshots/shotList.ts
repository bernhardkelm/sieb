import type { PageDriver } from '#scripts/screenshots/chrome/pageDriver.ts'
import { IMAGE } from '#scripts/screenshots/seed/seedImages.ts'
import type { Shot } from '#scripts/screenshots/takeShots.ts'

const PANEL = '.finding-panel'
const REASON =
  'The worker only verifies server certificates of internal services, crafted certificates never reach it.'

/**
 * Fills the decision form of the open finding panel (not affected, a justification, a reason)
 * and scrolls the panel so the KEV details sit above the form.
 * @param {PageDriver} page - Page on a view with the finding panel open
 * @returns {Promise<void>} - Resolves once the form is filled
 */
const fillDecision = async (page: PageDriver): Promise<void> => {
  await page.click(`${PANEL} [role="radio"]`, { text: 'Not affected' })
  await page.click(`${PANEL} .trigger`)
  await page.click('[role="option"]', { text: 'Vulnerable code not in execute path' })
  await page.type(`${PANEL} textarea`, REASON)
  await page.blur()
  await page.scrollTo(`${PANEL} #panel-decision`, {}, 'center')
}

/**
 * Checks the first five rows of the Triage list and opens the bulk decision dialog.
 * @param {PageDriver} page - Page on the Triage view
 * @returns {Promise<void>} - Resolves once the dialog is open
 */
const openBulk = async (page: PageDriver): Promise<void> => {
  for (let index = 0; index < 5; index += 1) {
    await page.click('.row-checkbox', { index })
  }

  await page.click('.bulk-button', { text: 'Decide' })
  await page.blur()
}

/** Shots in run order, those that change server state, such as a seen mark, come last */
export const SHOTS: readonly Shot[] = [
  { name: 'mobile', viewport: 'phone', path: () => '/triage' },
  { name: 'inbox', viewport: 'desktop', path: () => '/inbox' },
  {
    name: 'proposal',
    viewport: 'desktop',
    path: (seed) => `/inbox/proposals/${seed.reviewProposalId}`,
  },
  {
    name: 'proposal-evidence',
    viewport: 'desktop',
    path: (seed) => `/inbox/proposals/${seed.reviewProposalId}`,
    prepare: (page) => page.scrollTo('#review-basis'),
  },
  {
    name: 'mobile-proposal',
    viewport: 'phone',
    path: (seed) => `/inbox/proposals/${seed.reviewProposalId}`,
  },
  {
    name: 'inconclusive',
    viewport: 'desktop',
    path: (seed) => `/inbox/proposals/${seed.inconclusiveProposalId}`,
  },
  { name: 'checks', viewport: 'desktop', path: () => '/checks' },
  {
    name: 'checks-recent',
    viewport: 'desktop',
    path: () => '/checks',
    prepare: (page) => page.scrollTo('h2, h3', { text: 'Recent' }),
  },
  { name: 'access', viewport: 'desktop', path: () => '/access' },
  {
    name: 'access-form',
    viewport: 'desktop',
    path: () => '/access',
    prepare: (page) => page.click('button', { text: 'Add credential' }),
  },
  {
    name: 'images',
    viewport: 'desktop',
    path: () => `/images?image=${encodeURIComponent(IMAGE.nginx)}`,
  },
  {
    name: 'decisions',
    viewport: 'desktop',
    path: (seed) => `/decisions?state=reopened&decision=${seed.reopenedDecisionId}`,
  },
  { name: 'bulk', viewport: 'desktop', path: () => '/triage', prepare: openBulk },
  { name: 'triage', viewport: 'desktop', path: (seed) => `/triage?finding=${seed.panelFindingId}` },
  {
    name: 'handoff',
    viewport: 'desktop',
    path: (seed) => `/triage?finding=${seed.panelFindingId}`,
    prepare: (page) => page.click(`${PANEL} [aria-label="More ways to hand off to Claude"]`),
  },
  {
    name: 'panel',
    viewport: 'desktop',
    path: (seed) => `/triage?finding=${seed.panelFindingId}`,
    prepare: fillDecision,
    clip: PANEL,
  },
]
