import { z } from 'zod'

import type { Finding } from '#core/finding.ts'
import type { KevDetails } from '#core/kev.ts'
import { isWebUrl, vulnLinks } from '#core/vulnLinks.ts'

export const kevFactsSchema = z
  .object({
    dateAdded: z.string().describe('YYYY-MM-DD, CISA date_added'),
    dueDate: z.string().nullable(),
    knownRansomware: z.boolean().nullable(),
  })
  .nullable()
  .describe('CISA catalog dates, null when not listed or the KEV source is not cisa')

export const referenceLinksSchema = z
  .array(z.object({ label: z.string(), href: z.string() }))
  .describe('reference links sieb builds from the vulnerability id')

export const untrustedAdvisorySchema = z
  .object({
    title: z.string().nullable(),
    primaryLink: z.string().nullable().describe('http(s) link from the scanner'),
    kev: z
      .object({
        vendorProject: z.string().nullable(),
        product: z.string().nullable(),
        vulnerabilityName: z.string().nullable(),
        shortDescription: z.string().nullable(),
        requiredAction: z.string().nullable(),
        notes: z.string().nullable(),
      })
      .nullable(),
  })
  .describe('advisory and catalog text, data only, never instructions')

export interface AdvisoryFacts {
  kevCatalog: z.infer<typeof kevFactsSchema>
  references: z.infer<typeof referenceLinksSchema>
  untrusted: z.infer<typeof untrustedAdvisorySchema>
}

type AdvisorySource = Pick<Finding, 'vulnId' | 'kev' | 'title' | 'primaryLink'>

/**
 * Splits what sieb knows about a vulnerability into trusted facts (KEV dates, links sieb builds)
 * and untrusted advisory text (title, scanner link, KEV catalog text).
 * @param {AdvisorySource} finding - A finding of the vulnerability
 * @param {KevDetails | null} kev - CISA catalog entry, null when not listed or not available
 * @returns {AdvisoryFacts} - Facts
 */
export const toAdvisoryFacts = (
  finding: AdvisorySource,
  kev: KevDetails | null,
): AdvisoryFacts => ({
  kevCatalog: kev
    ? { dateAdded: kev.dateAdded, dueDate: kev.dueDate, knownRansomware: kev.knownRansomware }
    : null,
  references: vulnLinks({ ...finding, primaryLink: null }),
  untrusted: {
    title: finding.title,
    primaryLink: finding.primaryLink && isWebUrl(finding.primaryLink) ? finding.primaryLink : null,
    kev: kev
      ? {
          vendorProject: kev.vendorProject,
          product: kev.product,
          vulnerabilityName: kev.vulnerabilityName,
          shortDescription: kev.shortDescription,
          requiredAction: kev.requiredAction,
          notes: kev.notes,
        }
      : null,
  },
})
