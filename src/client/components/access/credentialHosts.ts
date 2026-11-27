import { PROVIDER_SPECS } from '#core/privateAccess.ts'
import type { CredentialFormModel } from '@/components/access/credentialFormModel'

/** Hosts the form values point at, the provider defaults where a host is empty */
export interface CredentialHosts {
  registry: string
  git: string
  /** Hosts of the chosen uses, registry first */
  covered: string[]
}

/**
 * Returns the hosts of the form values for the field hints and examples.
 * @param {CredentialFormModel} model - Form values
 * @returns {CredentialHosts} - Registry and git host, and those of the chosen uses
 */
export const credentialHostsOf = (model: CredentialFormModel): CredentialHosts => {
  const spec = PROVIDER_SPECS[model.provider]
  const registry = model.registryHost.trim() || (spec.registryHost ?? '')
  const git = model.gitHost.trim() || (spec.gitHost ?? '')
  const covered = [
    model.uses.includes('registry') ? registry : '',
    model.uses.includes('git') ? git : '',
  ].filter((host) => host !== '')

  return { registry, git, covered }
}
