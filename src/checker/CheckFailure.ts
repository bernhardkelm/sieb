/** An expected failure of a check step, its message is the short reason sieb shows */
export class CheckFailure extends Error {
  /**
   * Creates the failure with a short reason for humans.
   * @param {string} message - Short reason, no secrets
   * @returns {void}
   */
  constructor(message: string) {
    super(message)
    this.name = 'CheckFailure'
  }
}
