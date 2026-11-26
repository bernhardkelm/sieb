export const DEFAULT_RETURN_PATH = '/'

const MAX_RETURN_PATH_LENGTH = 2048
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/

/**
 * Narrows the return target of a login to a path on sieb itself, so the login cannot become an
 * open redirect. Only a path starting with a single slash passes, returned as given, never
 * normalised (normalising /.//x would yield the protocol-relative //x, so that is refused too). Protocol-relative values,
 * backslashes anywhere (browsers read them as slashes), anything but printable ASCII (browsers
 * strip tabs and newlines, so a stripped value could turn protocol-relative, and a Location
 * header takes no other characters), overlong values and paths into /auth fall back to the root.
 * @param {string | undefined} raw - Decoded return query parameter
 * @returns {string} - Safe relative path
 */
export const safeReturnPath = (raw: string | undefined): string => {
  if (
    raw === undefined ||
    raw.length > MAX_RETURN_PATH_LENGTH ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.includes('\\') ||
    !PRINTABLE_ASCII.test(raw)
  ) {
    return DEFAULT_RETURN_PATH
  }

  const { pathname, origin } = new URL(raw, 'http://sieb.invalid')

  if (
    origin !== 'http://sieb.invalid' ||
    pathname.startsWith('//') ||
    pathname === '/auth' ||
    pathname.startsWith('/auth/')
  ) {
    return DEFAULT_RETURN_PATH
  }

  return raw
}
