/**
 * Asynchronously parses HTML content from a Response object and returns a Document object.
 *
 * Checks whether the response content type is 'text/html'. If so, it reads the response body as text,
 * parses it into a Document object using DOMParser and returns the resulting Document. If the content type
 * is not HTML, it returns null.
 *
 * @param response - The Response object containing the HTML to parse.
 * @returns A Promise that resolves to a Document if the response contains HTML, or null otherwise (always `null` when `DOMParser` is not available, e.g. during SSR).
 */
export async function getDom(response: Response): Promise<Document | null> {
  const contentType = response.headers.get('content-type')
  if (typeof DOMParser === 'undefined') return null
  if (contentType && contentType.includes('text/html')) {
    const html = await response.text()
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    return doc
  }
  return null
}
