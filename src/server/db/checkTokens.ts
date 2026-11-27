import type { DatabaseSync } from 'node:sqlite'

import type { ApiToken } from '#core/apiToken.ts'
import { checkTokenName } from '#core/checkLimits.ts'
import { displayPrefixOf, generateTokenSecret, hashTokenSecret } from '#server/auth/tokenSecrets.ts'
import { getOwnToken } from '#server/db/apiTokenRepository.ts'
import { storeToken } from '#server/db/storeApiToken.ts'

/**
 * Mints the propose token of a check for its requester, marked with the check id: /mcp binds it
 * to the check's finding, and the token list, the live-token cap and the Claude connection leave
 * it out. The expiry comes from the check timeout; only the hash is stored like for every token.
 * @param {DatabaseSync} db - Open database
 * @param {{ owner: string; checkId: number; expiresAt: Date }} token - Requester, check and expiry
 * @param {Date} now - Creation time
 * @returns {{ token: ApiToken; secret: string }} - Stored token and its secret, which is never stored
 */
export const mintCheckToken = (
  db: DatabaseSync,
  { owner, checkId, expiresAt }: { owner: string; checkId: number; expiresAt: Date },
  now: Date,
): { token: ApiToken; secret: string } => {
  const secret = generateTokenSecret()
  const token = storeToken(
    db,
    {
      owner,
      input: {
        name: checkTokenName(checkId),
        scope: 'propose',
        expiresAt: expiresAt.toISOString(),
      },
      prefix: displayPrefixOf(secret),
      hash: hashTokenSecret(secret),
      checkId,
    },
    now,
  )

  return { token, secret }
}

/**
 * Deletes the token of an ended check. Proposals filed with it keep their token_id, which is
 * never handed out again.
 * @param {DatabaseSync} db - Open database
 * @param {{ owner: string; tokenId: number }} token - Requester and token id
 * @returns {ApiToken | null} - Deleted token, null when it was already gone
 */
export const dropCheckToken = (
  db: DatabaseSync,
  { owner, tokenId }: { owner: string; tokenId: number },
): ApiToken | null => {
  const token = getOwnToken(db, owner, tokenId)

  if (token !== null) {
    db.prepare('DELETE FROM api_tokens WHERE id = ? AND owner = ?').run(tokenId, owner)
  }

  return token
}
