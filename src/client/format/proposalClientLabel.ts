import type { ProposalClientKind } from '#core/proposalClient.ts'

/** Client fields of a proposal or its Inbox item */
export interface ProposalClientFields {
  clientKind: ProposalClientKind | null
  clientLabel: string
  agent: string | null
}

export const PROPOSAL_CLIENT_LABELS: Record<Exclude<ProposalClientKind, 'auto_check'>, string> = {
  claude_app: 'Claude app',
  claude_code: 'Claude Code',
  claude_code_cli: 'Claude Code (CLI)',
  claude_code_headless: 'Claude Code (headless)',
  claude_code_vscode: 'Claude Code (VS Code)',
  claude_code_app: 'Claude Code (app)',
}

/**
 * Returns the client label of a proposal: the label of its client kind, for an Auto-check the
 * check token name such as "Auto-check #2", without a kind the agent with the client label.
 * @param {ProposalClientFields} proposal - Client kind, client label and agent
 * @returns {string} - Such as "Claude Code (CLI)" or "Claude Code (laptop)"
 */
export const proposalClientLabel = ({
  clientKind,
  clientLabel,
  agent,
}: ProposalClientFields): string => {
  if (clientKind === 'auto_check') {
    return clientLabel
  }

  if (clientKind !== null) {
    return PROPOSAL_CLIENT_LABELS[clientKind]
  }

  return agent !== null && agent !== '' && agent !== clientLabel
    ? `${agent} (${clientLabel})`
    : clientLabel
}
