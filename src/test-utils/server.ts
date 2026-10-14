import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

/** What the test server saw for one request. */
export interface SeenRequest {
  method: string
  path: string
  headers: IncomingMessage['headers']
  body: Buffer
}

/** A running local test server. */
export interface TestServer {
  server: Server
  port: number
  origin: string
  /** Every request received, in order. */
  seen: SeenRequest[]
  /** Last request received. */
  last: () => SeenRequest
  /** Closes the server. */
  close: () => Promise<void>
}

/**
 * Reads the whole request body.
 *
 * @param req - Incoming request.
 * @returns The body as a Buffer.
 */
function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * Sends a JSON response.
 *
 * @param res - Server response.
 * @param status - HTTP status.
 * @param data - Value to serialize.
 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

/**
 * Starts a local HTTP server on 127.0.0.1 (random port). Routes under `/api`:
 * `/echo` (echoes method, headers and body as JSON), `/status/:code`, `/empty` (204),
 * `/text`, `/html`, `/file` (with Content-Disposition), `/rawfile` (no Content-Disposition),
 * `/envelope`, `/envelope-list`, `/envelope-false` (`{ success, message, data }` bodies), `/plain-json`
 * (`{ access_token }`), `/205`, `/protected` (401 unless `Authorization: Bearer fresh`), `/slow-protected` (same, but 400ms when authorized),
 * `/slow` (answers after 400ms), `/slow2` (after 150ms). When `cors` is true,
 * CORS headers are added and preflights are answered.
 *
 * @param cors - Enable permissive CORS (needed to call it cross-origin).
 * @returns The running server.
 */
export async function startTestServer(cors = false): Promise<TestServer> {
  const seen: SeenRequest[] = []
  const server = createServer((req, res) => {
    void (async () => {
      if (cors) {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Headers', '*')
        res.setHeader('Access-Control-Allow-Methods', '*')
        res.setHeader('Access-Control-Expose-Headers', '*')
        if (req.method === 'OPTIONS') {
          res.writeHead(204)
          res.end()
          return
        }
      }
      const body = await readBody(req)
      const path = (req.url ?? '').split('?')[0]
      seen.push({ method: req.method ?? '', path, headers: req.headers, body })
      const status = /^\/api\/status\/(\d+)$/.exec(path)
      if (status) {
        res.writeHead(Number(status[1]), { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'boom', code: Number(status[1]) }))
      } else if (path === '/api/echo') {
        sendJson(res, 200, {
          method: req.method,
          contentType: req.headers['content-type'] ?? null,
          authorization: req.headers.authorization ?? null,
          csrf: req.headers['x-csrftoken'] ?? null,
          headers: req.headers,
          body: body.toString('utf8'),
        })
      } else if (path === '/api/envelope') {
        sendJson(res, 200, { success: true, message: 'ok', data: { id: 1 } })
      } else if (path === '/api/envelope-list') {
        sendJson(res, 200, { success: true, data: [1, 2] })
      } else if (path === '/api/envelope-false') {
        sendJson(res, 200, { success: false, message: 'nope', data: null })
      } else if (path === '/api/plain-json') {
        sendJson(res, 200, { access_token: 'tok' })
      } else if (path === '/api/205') {
        res.writeHead(205)
        res.end()
      } else if (path === '/api/protected') {
        if (req.headers.authorization === 'Bearer fresh')
          sendJson(res, 200, { ok: true, method: req.method, body: body.toString('utf8') })
        else sendJson(res, 401, { detail: 'expired' })
      } else if (path === '/api/slow-protected') {
        if (req.headers.authorization === 'Bearer fresh')
          setTimeout(() => sendJson(res, 200, { ok: true }), 400)
        else sendJson(res, 401, { detail: 'expired' })
      } else if (path === '/api/empty') {
        res.writeHead(204)
        res.end()
      } else if (path === '/api/text') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('hello plain text')
      } else if (path === '/api/html') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body><h1>Hi</h1></body></html>')
      } else if (path === '/api/file') {
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="report.txt"',
        })
        res.end('file-content')
      } else if (path === '/api/rawfile') {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
        res.end('raw-content')
      } else if (path === '/api/slow' || path === '/api/slow2') {
        setTimeout(() => sendJson(res, 200, { ok: true }), path === '/api/slow' ? 400 : 150)
      } else {
        sendJson(res, 404, { message: 'not found' })
      }
    })()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  return {
    server,
    port,
    origin: `http://127.0.0.1:${port}`,
    seen,
    last: () => seen[seen.length - 1],
    close: () =>
      new Promise<void>(resolve => {
        server.closeAllConnections?.()
        server.close(() => resolve())
      }),
  }
}

/**
 * Finds a port that is currently closed (listen on a random port, then close it).
 *
 * @returns A closed port number.
 */
export async function getClosedPort(): Promise<number> {
  const s = createServer()
  await new Promise<void>(resolve => s.listen(0, '127.0.0.1', resolve))
  const port = (s.address() as AddressInfo).port
  await new Promise<void>(resolve => s.close(() => resolve()))
  return port
}
