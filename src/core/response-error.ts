/** Maximum number of body characters returned by `getDisplayMessage()`. */
const MAX_DISPLAY_LENGTH = 200

/**
 * Checks whether a value is an abort error (`AbortError`, e.g. a `DOMException` raised by `AbortController`).
 *
 * @param value - The value to check.
 * @returns `true` if the value has the name `AbortError`.
 */
function isAbortError(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { name?: unknown }).name === 'AbortError'
  )
}

/**
 * Represents an error that occurs during an HTTP request.
 * Extends the native `Error` class to include additional response information,
 * such as the status code, the status text and the original `Response` object.
 *
 * It can wrap either a real HTTP `Response` or a low-level `Error` (network failure, `AbortError`):
 * in the latter case the original error is kept in `cause`, `response` is `undefined`, `status` is `0`
 * and the original message and stack are preserved.
 *
 * Provides utility methods to safely extract text or JSON data from the response (the body is always
 * read from a clone, so it can be read again by the caller even after `showMessage()`),
 * and to show the error with the configured `errorMessageFunction` (if any).
 *
 * @property {Response | undefined} response - The original HTTP response, `undefined` for network errors and aborts.
 * @property {unknown} cause - The original `Error`, when the instance was built from one.
 * @property {(err: ResponseError) => Promise<void> | void} [messageFunction] - Function that shows the error to the user, if configured.
 * @property {number} status - The HTTP status code of the response (`0` when there is no response).
 * @property {string} statusText - The HTTP status text, or the original error message when there is no response.
 */
export class ResponseError extends Error {
  response?: Response
  messageFunction?: (err: ResponseError) => Promise<void> | void
  status: number
  statusText: string

  /**
   * Constructs a new `ResponseError` instance.
   *
   * @param source - The `Response` object, or the `Error` (network error, `AbortError`) associated with the failure.
   * @param options - Optional configuration.
   * @param options.messageFunction - Function that shows the error to the user (used by `showMessage()`).
   */
  constructor(
    source: Response | Error,
    {
      messageFunction,
    }: { messageFunction?: ((err: ResponseError) => Promise<void> | void) | null } = {}
  ) {
    const isResponse = typeof Response !== 'undefined' && source instanceof Response
    const hasStatus =
      isResponse ||
      (typeof source === 'object' &&
        source !== null &&
        typeof (source as Response).status === 'number' &&
        'headers' in source)
    super(
      hasStatus
        ? (source as Response).statusText || `HTTP ${(source as Response).status}`
        : (source as Error)?.message || 'Network Error'
    )
    Object.setPrototypeOf(this, new.target.prototype) // required for correctly extending Error
    this.name = 'ResponseError'
    if (hasStatus) {
      this.response = source as Response
      this.status = this.response.status
      this.statusText = this.response.statusText // may be empty (e.g. HTTP/2); `message` then is `HTTP <status>`
    } else {
      this.cause = source
      this.status = 0
      this.statusText = this.message
      if ((source as Error)?.stack) this.stack = (source as Error).stack
    }
    if (typeof messageFunction === 'function') this.messageFunction = messageFunction
  }

  /**
   * Whether the error comes from an aborted request (`AbortError`).
   * Aborts are intentional, so `showMessage()` never displays them.
   *
   * @returns `true` if the wrapped error (or this error) is an `AbortError`.
   */
  get isAbort(): boolean {
    return isAbortError(this.cause) || isAbortError(this)
  }

  /**
   * Safely retrieves the response body as text, reading from a clone so the original body stays unread.
   *
   * If there is no response or reading fails, returns the status text (or the error message),
   * or 'Error' if neither is available.
   *
   * @returns The response text, the status text or a default error message.
   */
  async safeResponseText(): Promise<string> {
    if (!this.response) return this.statusText || this.message || 'Error'
    try {
      return await this.response.clone().text()
    } catch {
      return this.response.statusText || 'Error'
    }
  }

  /**
   * Builds a short, human-readable text for the error (never the whole body), used by `@ilpachi/use-alova/notify`:
   * - no response (network error): the error message;
   * - a plain-text body (non-empty, not HTML, i.e. not starting with `<`) truncated to 200 characters;
   * - otherwise the status text, falling back to `HTTP <status>` (HTTP/2 has an empty status text).
   *
   * @returns The text to display.
   */
  async getDisplayMessage(): Promise<string> {
    if (!this.response) return this.statusText || this.message || 'Error'
    const body = await this.response
      .clone()
      .text()
      .then(
        t => t.trim(),
        () => ''
      )
    if (body && !body.startsWith('<')) {
      return body.length > MAX_DISPLAY_LENGTH ? `${body.slice(0, MAX_DISPLAY_LENGTH)}…` : body
    }
    return this.statusText || `HTTP ${this.status}`
  }

  /**
   * Safely parses the response body as JSON (reading from a clone).
   * If there is no response or parsing fails, returns `null` instead of throwing an error.
   *
   * @returns A promise that resolves with the parsed JSON object, or `null` if parsing fails.
   */
  async safeResponseJson(): Promise<any> {
    if (!this.response) return null
    try {
      return await this.response.clone().json()
    } catch {
      return null
    }
  }

  /**
   * Safely retrieves and parses the response data.
   *
   * Reads the body as text once, then tries `JSON.parse`; if the text is not valid JSON
   * the plain text is returned. If there is no body or reading fails, returns `null`.
   *
   * @returns A promise that resolves with the parsed JSON, the plain text or `null`.
   */
  async safeResponseData(): Promise<any> {
    if (!this.response) return null
    try {
      const text = await this.response.clone().text()
      try {
        return JSON.parse(text) ?? text
      } catch {
        return text
      }
    } catch {
      return null
    }
  }

  /**
   * Asynchronously shows the current error with the configured `errorMessageFunction`.
   * Does nothing for aborted requests (`isAbort`) or when no message function is configured.
   *
   * @returns A promise that resolves when the messaging function has completed.
   */
  async showMessage(): Promise<void> {
    if (this.isAbort) return
    await this.messageFunction?.(this)
  }
}
