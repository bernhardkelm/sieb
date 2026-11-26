/** Current time provider, injected so core logic and tests never read the system clock */
export type Clock = () => Date
