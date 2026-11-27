import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/ApiError'
import { credentialFormErrors } from '@/components/access/credentialFormErrors'
import { localCredentialErrors } from '@/components/access/credentialLocalErrors'
import { newCredentialModel } from '@/components/access/credentialFormModel'

describe('credentialFormErrors', () => {
  it('maps validation issues to their fields, nested mapping fields to the mapping', () => {
    const error = new ApiError(
      400,
      {
        error: 'validation',
        errors: [
          { field: 'label', code: 'too_long' },
          { field: 'registryHost', code: 'not_allowed' },
          { field: 'repoMapping.repoPrefix', code: 'invalid' },
          { field: null, code: 'invalid' },
        ],
      },
      '/api/credentials',
    )
    const errors = credentialFormErrors(error)

    expect(errors.label).toEqual(['At most 64 characters.'])
    expect(errors.registryHost).toEqual(['This provider does not allow it.'])
    expect(errors.repoMapping).toEqual(['Not a valid value.'])
    expect(errors.general).toEqual(['Not a valid value.'])
  })

  it('puts a duplicate scope at the prefix and names the other refusals', () => {
    const duplicate = new ApiError(409, { error: 'duplicate_scope' }, '/api/credentials')
    const full = new ApiError(409, { error: 'too_many_credentials' }, '/api/credentials')

    expect(credentialFormErrors(duplicate).pathPrefix).toEqual([
      'Another credential already covers these hosts with this path prefix.',
    ])
    expect(credentialFormErrors(full).general).toEqual([
      'sieb holds no more credentials, delete one first.',
    ])
  })

  it('asks for the token at its field when a change would send it to a new host', () => {
    const required = new ApiError(409, { error: 'secret_required' }, '/api/credentials/4')
    const outside = new ApiError(
      400,
      {
        error: 'validation',
        errors: [{ field: 'repoMapping.registryPrefix', code: 'outside_scope' }],
      },
      '/api/credentials',
    )

    expect(credentialFormErrors(required).secret).toEqual([
      expect.stringContaining('Enter the token again'),
    ])
    expect(credentialFormErrors(outside).repoMapping).toEqual([
      expect.stringContaining('within the hosts and path prefix'),
    ])
  })

  it('names a missing credential and keeps other failures general', () => {
    const gone = new ApiError(404, { error: 'not_found' }, '/api/credentials/4')

    expect(credentialFormErrors(gone).general).toEqual(['This credential no longer exists.'])
    expect(credentialFormErrors(new Error('offline')).general).toEqual(['offline'])
  })
})

describe('localCredentialErrors', () => {
  it('asks for label, token and the username where the provider needs one', () => {
    const errors = localCredentialErrors(newCredentialModel('dockerhub'), false)

    expect(errors.label).toHaveLength(1)
    expect(errors.secret).toHaveLength(1)
    expect(errors.username).toHaveLength(1)
    expect(localCredentialErrors(newCredentialModel('github'), false).username).toEqual([])
  })

  it('keeps the token optional while editing and wants both mapping prefixes or neither', () => {
    const model = { ...newCredentialModel('github'), label: 'Code', registryPrefix: 'ghcr.io/x/' }
    const errors = localCredentialErrors(model, true)

    expect(errors.secret).toEqual([])
    expect(errors.repoMapping).toEqual(['Fill in both prefixes, or leave both empty.'])
  })

  it('wants the hosts of a self-hosted GitLab for the chosen uses', () => {
    const model = { ...newCredentialModel('gitlab'), registryHost: ' ', gitHost: '' }
    const errors = localCredentialErrors({ ...model, uses: ['registry'] }, false)

    expect(errors.registryHost).toHaveLength(1)
    expect(errors.gitHost).toEqual([])
  })
})
