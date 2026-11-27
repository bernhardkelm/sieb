/**
 * Returns the basic auth value of a login.
 * @param {string} username - User name without colon
 * @param {string} secret - Secret
 * @returns {string} - base64 of username:secret
 */
export const basicAuth = (username: string, secret: string): string =>
  Buffer.from(`${username}:${secret}`).toString('base64')
