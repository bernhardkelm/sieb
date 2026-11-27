/** How the UI user is authenticated: forward-auth header or sieb's own OIDC login */
export type AuthMode = 'header' | 'oidc'

/** Running sieb build, the source code link offered to every user under the AGPL */
export interface BuildInfo {
  version: string
  sourceCodeUrl: string // SIEB_SOURCE_URL, otherwise the upstream tree of the version tag
}

export interface MeResponse extends BuildInfo {
  username: string | null // null when neither the auth header nor a dev user is present
  authMode: AuthMode
}

/** Answer of POST /auth/logout: where the browser goes to end the issuer session too */
export interface LogoutResponse {
  redirect: string // absolute URL, the issuer end-session endpoint or the public URL
}
