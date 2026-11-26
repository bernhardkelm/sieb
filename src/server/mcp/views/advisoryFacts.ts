import { z } from 'zod'

import type { Finding } from '#core/finding.ts'
import { KEV_SOURCES, type KevDetails, type KevSourceKind } from '#core/kev.ts'
import { isWebUrl, vulnLinks } from '#core/vulnLinks.ts'

export const kevFactsSchema = z
  .object({
    dateAdded: z.string().describe('YYYY-MM-DD, CISA date_added'),
    dueDate: z.string().nullable(),
    knownRansomware: z.boolean().nullable(),
  })
  .nullable()
  .describe('CISA catalog dates, null when not listed or when kevSource is not cisa')

export const kevSourceSchema = z
  .enum(KEV_SOURCES as [KevSourceKind, ...KevSourceKind[]])
  .describe('where the KEV flag comes from, SIEB_KEV_SOURCE')

export const kevNoteSchema = z
  .string()
  .nullable()
  .describe('why kevCatalog is null for a KEV flagged vulnerability, null otherwise')

export const KEV_QUERY_NOTE =
  'KEV flag comes from the configured Prometheus KEV query; CISA catalog details are only available with the cisa KEV source.'

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
  kevSource: KevSourceKind
  kevNote: string | null
  kevCatalog: z.infer<typeof kevFactsSchema>
  references: z.infer<typeof referenceLinksSchema>
  untrusted: z.infer<typeof untrustedAdvisorySchema>
}

type AdvisorySource = Pick<Finding, 'vulnId' | 'kev' | 'title' | 'primaryLink'>

/**
 * Returns the note that explains a missing CISA catalog entry of a KEV flagged vulnerability.
 * @param {KevSourceKind} kevSource - Configured KEV source
 * @param {boolean} flagged - Whether the vulnerability is KEV flagged
 * @returns {string | null} - Note, null for the cisa source or an unflagged vulnerability
 */
export const kevNote = (kevSource: KevSourceKind, flagged: boolean): string | null =>
  kevSource !== 'cisa' && flagged ? KEV_QUERY_NOTE : null

/**
 * Splits what sieb knows about a vulnerability into trusted facts (KEV source and dates, links
 * sieb builds) and untrusted advisory text (title, scanner link, KEV catalog text).
 * @param {AdvisorySource} finding - A finding of the vulnerability, kev is its KEV flag
 * @param {KevDetails | null} kev - CISA catalog entry, null when not listed or not available
 * @param {KevSourceKind} kevSource - Configured KEV source
 * @returns {AdvisoryFacts} - Facts
 */
export const toAdvisoryFacts = (
  finding: AdvisorySource,
  kev: KevDetails | null,
  kevSource: KevSourceKind,
): AdvisoryFacts => ({
  kevSource,
  kevNote: kevNote(kevSource, finding.kev),
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
