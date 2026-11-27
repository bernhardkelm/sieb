import type { AccessProvider } from '#core/privateAccess.ts'
import type { CredentialSecret } from '#server/credentials/credentialVault.ts'

/** Username and secret as registries and git hosts take them in basic auth */
export interface CredentialLogin {
  username: string
  secret: string
}

const DEFAULT_USERNAMES: Record<AccessProvider, string> = {
  github: 'x-access-token', // any username works with a GitHub token
  gitlab: 'oauth2', // what GitLab expects for personal and OAuth tokens
  dockerhub: 'x-access-token', // never used, Docker Hub requires a username
}

/**
 * Returns the login of an opened credential, the provider's placeholder username where the
 * token needs none.
 * @param {AccessProvider} provider - Provider of the credential
 * @param {CredentialSecret} secret - Opened username and secret
 * @returns {CredentialLogin} - Login
 */
export const loginOf = (provider: AccessProvider, secret: CredentialSecret): CredentialLogin => ({
  username: secret.username ?? DEFAULT_USERNAMES[provider],
  secret: secret.secret,
})
