import type { ProposalDetail, ProposalListItem } from '#core/proposalApiTypes.ts'
import type { ProposalSeed } from '#scripts/screenshots/seed/proposalSeeds.ts'
import type { SiebApi } from '#scripts/screenshots/seed/siebApi.ts'

/**
 * Returns the id of the open proposal on one image of a CVE.
 * @param {SiebApi} api - Seed client
 * @param {string} vulnId - CVE id
 * @param {string} imageRef - Image ref
 * @returns {Promise<number>} - Proposal id
 * @throws {Error} - When there is no such proposal
 */
export const openProposalId = async (
  api: SiebApi,
  vulnId: string,
  imageRef: string,
): Promise<number> => {
  const items = await api.request<ProposalListItem[]>(
    'GET',
    `/api/proposals?vulnId=${encodeURIComponent(vulnId)}`,
  )
  const item = items.find(({ proposal }) => proposal.imageRefs?.includes(imageRef))

  if (item === undefined) {
    throw new Error(`no open proposal for ${vulnId} on ${imageRef}`)
  }

  return item.proposal.id
}

/**
 * Accepts the open proposal on one image of a CVE without edits, as a reviewer would.
 * @param {SiebApi} api - Seed client
 * @param {string} vulnId - CVE id
 * @param {string} imageRef - Image ref
 * @returns {Promise<void>} - Resolves once accepted
 */
export const acceptProposal = async (
  api: SiebApi,
  vulnId: string,
  imageRef: string,
): Promise<void> => {
  const id = await openProposalId(api, vulnId, imageRef)
  const detail = await api.request<ProposalDetail>('GET', `/api/proposals/${id}`)

  await api.request('POST', `/api/proposals/${id}/accept`, {
    expectedDecisionIds: detail.currentDecisionIds,
  })
}

/**
 * Files proposals through MCP with a personal token, each under its own client identity.
 * @param {SiebApi} api - Seed client
 * @param {string} secret - Personal token with the propose scope
 * @param {readonly ProposalSeed[]} seeds - Proposals
 * @returns {Promise<void>} - Resolves once all are filed
 */
export const fileProposals = async (
  api: SiebApi,
  secret: string,
  seeds: readonly ProposalSeed[],
): Promise<void> => {
  for (const { client, args } of seeds) {
    await api.callTool(secret, client, 'propose_decision', args)
  }
}
