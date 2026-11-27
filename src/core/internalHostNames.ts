// names that resolve inside a cluster, a host or a private network, never a public registry
const INTERNAL_SUFFIXES = ['localhost', 'local', 'internal', 'svc', 'home.arpa']

/**
 * Returns whether a host names something inside the cluster or the network sieb runs in: a
 * single label, localhost, or a name below .local, .svc, .cluster.local, .internal or
 * .home.arpa. A port and a trailing dot are ignored.
 * @param {string} host - Host, with or without port
 * @returns {boolean} - True for an internal name
 */
export const isInternalHostName = (host: string): boolean => {
  const name = host.trim().toLowerCase().replace(/:\d*$/u, '').replace(/\.+$/u, '')

  return (
    !name.includes('.') ||
    INTERNAL_SUFFIXES.some((suffix) => name === suffix || name.endsWith(`.${suffix}`))
  )
}
