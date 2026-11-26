import { styleHashSource } from '#server/auth/oidc/authPageHeaders.ts'
import { escapeHtml } from '#server/auth/oidc/authPages.ts'

// colours mirror src/client/assets/tokens.css, the page cannot load the client stylesheet without a session
const SIGN_IN_CSS = `
:root {
  color-scheme: light dark;
  --ink: hsl(222 16% 14%);
  --paper: hsl(0 0% 100%);
  --page: color-mix(in srgb, var(--ink) 2%, var(--paper));
  --muted: color-mix(in srgb, var(--ink) 62%, var(--paper));
  --border: color-mix(in srgb, var(--ink) 10%, var(--paper));
  --accent: #4b52d2;
  --on-accent: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: hsl(220 13% 91%);
    --paper: hsl(225 7% 11%);
    --page: color-mix(in srgb, hsl(225 10% 4%) 30%, var(--paper));
    --accent: #7e84f1;
    --on-accent: #12142b;
  }
}
* {
  box-sizing: border-box;
}
body {
  display: grid;
  place-items: center;
  min-height: 100vh;
  margin: 0;
  padding: 1rem;
  background: var(--page);
  color: var(--ink);
  font: 0.9375rem/1.5 Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
  max-width: 20rem;
  padding: 2rem 1.5rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--paper);
  text-align: center;
}
.mark {
  width: 3rem;
  height: 3rem;
}
.tile {
  fill: var(--accent);
}
.mesh {
  fill: var(--on-accent);
}
h1 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}
p {
  margin: 0;
  color: var(--muted);
  font-size: 0.8125rem;
}
.button {
  display: block;
  width: 100%;
  padding: 0.5rem 1rem;
  border-radius: 5px;
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 500;
  text-decoration: none;
}
.button:hover {
  background: color-mix(in srgb, var(--accent) 88%, var(--ink));
}
.button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
`

export const SIGN_IN_STYLE = styleHashSource(SIGN_IN_CSS)

const MARK_SVG = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
<rect class="tile" width="32" height="32" rx="7"/>
<g class="mesh"><circle cx="8.5" cy="9.5" r="2.5"/><circle cx="16" cy="9.5" r="2.5"/><circle cx="23.5" cy="9.5" r="2.5"/><circle cx="12.25" cy="16" r="2.5"/><circle cx="19.75" cy="16" r="2.5"/><circle cx="16" cy="22.5" r="2.5"/></g>
</svg>`

/** What the sign-in page shows */
export interface SignInPageContent {
  returnTo: string // validated return path, handed on to the login
  displayName: string
  signedOut: boolean
}

/**
 * Renders the sign-in page of the oidc mode: the sieb mark, the title, an optional signed-out
 * note and a focused button that starts the login with the return path. Everything is inline and
 * escaped, the page loads nothing and runs no script.
 * @param {SignInPageContent} content - Return path, provider name, signed-out flag
 * @returns {string} - HTML document
 */
export const signInPageHtml = ({ returnTo, displayName, signedOut }: SignInPageContent): string => {
  const loginHref = `/auth/login?return=${encodeURIComponent(returnTo)}`
  const note = signedOut ? '\n<p>You are signed out of sieb.</p>' : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>Sign in to sieb</title>
<style>${SIGN_IN_CSS}</style>
</head>
<body>
<main>
${MARK_SVG}
<h1>sieb</h1>${note}
<a class="button" href="${escapeHtml(loginHref)}" autofocus>Sign in with ${escapeHtml(displayName)}</a>
</main>
</body>
</html>`
}
