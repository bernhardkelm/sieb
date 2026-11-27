import { describe, expect, it } from 'vitest'

import { buildCredential } from '@/__tests__/credentialBuilders'
import {
  credentialInputOf,
  credentialModelOf,
  credentialPatchOf,
  newCredentialModel,
} from '@/components/access/credentialFormModel'

describe('credentialInputOf', () => {
  it('leaves the fixed GitHub hosts to the server and sends no username', () => {
    const model = { ...newCredentialModel('github'), label: ' Code ', secret: ' github_pat_x ' }

    expect(credentialInputOf(model)).toEqual({
      provider: 'github',
      label: 'Code',
      uses: ['registry', 'git'],
      pathPrefix: '',
      repoMapping: null,
      username: null,
      secret: 'github_pat_x',
    })
  })

  it('sends the hosts of a self-hosted GitLab, null for a use that is not chosen', () => {
    const model = {
      ...newCredentialModel('gitlab'),
      label: 'GitLab',
      uses: ['git' as const],
      registryHost: 'registry.gitlab.example.com',
      gitHost: ' gitlab.example.com ',
      username: 'gitlab+deploy-token-3',
      secret: 'gldt-x',
    }
    const input = credentialInputOf(model)

    expect(input.registryHost).toBeNull()
    expect(input.gitHost).toBe('gitlab.example.com')
    expect(input.username).toBe('gitlab+deploy-token-3')
  })

  it('sends a mapping only when a prefix is filled in', () => {
    const model = {
      ...newCredentialModel('gitlab'),
      registryPrefix: 'registry.gitlab.com/your-group/',
      repoPrefix: 'gitlab.com/your-group/',
    }

    expect(credentialInputOf(model).repoMapping).toEqual({
      registryPrefix: 'registry.gitlab.com/your-group/',
      repoPrefix: 'gitlab.com/your-group/',
    })
  })
})

describe('credentialPatchOf', () => {
  it('never prefills the token and sends one only when a new one was typed', () => {
    const model = credentialModelOf(buildCredential())

    expect(model.secret).toBe('')
    expect(credentialPatchOf(model)).toEqual({
      label: 'GitLab your-group',
      pathPrefix: 'your-group/',
      repoMapping: null,
      username: 'gitlab+deploy-token-12',
    })
    expect(credentialPatchOf({ ...model, secret: 'gldt-new' }).secret).toBe('gldt-new')
  })
})
