import { createServer } from 'node:http'
import { open, lstat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

const host = '127.0.0.1'
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.md', 'text/plain; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.csv', 'text/plain; charset=utf-8']
])
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "worker-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'"
  ].join('; ')
}

export function parsePort(args) {
  if (!args.length) return 3020
  const match = args.length === 1 && /^--port=(\d{4,5})$/.exec(args[0])
  const value = match ? Number(match[1]) : NaN
  if (!Number.isInteger(value) || value < 1024 || value > 65535)
    throw new Error(
      'Use node server.mjs [--port=3020], with a port from 1024 to 65535.'
    )
  return value
}

/** Serve an immutable distribution tree, never the caller's working directory. */
export async function startLocalServer({ root, port = 3020 }) {
  if (
    !path.isAbsolute(root) ||
    !Number.isInteger(port) ||
    port < 0 ||
    port > 65535
  )
    throw new Error(
      'An absolute distribution directory and valid port are required.'
    )
  if (!(await lstat(root)).isDirectory())
    throw new Error(
      'The distribution site directory is missing or is a symbolic link.'
    )
  if (!(await lstat(path.join(root, 'index.html'))).isFile())
    throw new Error(
      'The distribution index.html is missing or is a symbolic link.'
    )
  let origin
  const server = createServer(
    { maxHeaderSize: 8192 },
    async (request, response) => {
      const reject = (status, text) => {
        request.resume()
        response.writeHead(status, {
          ...headers,
          'Content-Type': 'text/plain; charset=utf-8',
          Connection: 'close'
        })
        response.end(text)
      }
      // Exact authority checks prevent DNS rebinding and cross-origin access.
      if (
        request.headers.host !== origin.slice(7) ||
        (request.headers.origin && request.headers.origin !== origin) ||
        request.headers['sec-fetch-site'] === 'cross-site'
      )
        return reject(403, 'Only this loopback origin is allowed.')
      if (request.method !== 'GET' && request.method !== 'HEAD')
        return reject(405, 'Only GET and HEAD are supported.')
      if (
        request.headers['transfer-encoding'] ||
        Number(request.headers['content-length'] ?? 0) !== 0
      )
        return reject(400, 'Request bodies are not supported.')
      let handle
      try {
        const raw = request.url ?? ''
        if (!raw.startsWith('/') || raw.startsWith('//'))
          return reject(400, 'Invalid path.')
        const pathname = decodeURIComponent(raw.split('?')[0])
        if (
          [...pathname].some(
            (character) =>
              character.charCodeAt(0) < 32 ||
              character.charCodeAt(0) === 127 ||
              character === '\\'
          )
        )
          return reject(400, 'Invalid path.')
        const segments =
          pathname === '/' ? ['index.html'] : pathname.slice(1).split('/')
        if (segments.some((segment) => !segment || segment.startsWith('.')))
          return reject(404, 'File not found.')
        let filename = root
        for (const [index, segment] of segments.entries()) {
          filename = path.join(filename, segment)
          const stat = await lstat(filename)
          if (
            stat.isSymbolicLink() ||
            (index < segments.length - 1 ? !stat.isDirectory() : !stat.isFile())
          )
            return reject(404, 'File not found.')
        }
        handle = await open(filename, 'r')
        const stat = await handle.stat()
        response.writeHead(200, {
          ...headers,
          'Content-Type':
            types.get(path.extname(filename)) ?? 'application/octet-stream',
          'Content-Length': stat.size
        })
        if (request.method === 'HEAD') response.end()
        else
          await new Promise((resolve, rejectStream) => {
            const stream = handle.createReadStream({ autoClose: false })
            stream.on('error', rejectStream)
            response.on('error', rejectStream)
            response.on('close', () => {
              stream.destroy()
              resolve()
            })
            stream.pipe(response)
          })
      } catch (error) {
        if (response.headersSent) response.destroy()
        else
          reject(
            error instanceof URIError ? 400 : 404,
            'File not found or unreadable.'
          )
      } finally {
        await handle?.close().catch(() => {
          // The response is already ended or destroyed; do not retry writes.
        })
      }
    }
  )
  server.requestTimeout = 10_000
  server.headersTimeout = 10_000
  server.keepAliveTimeout = 1000
  server.maxRequestsPerSocket = 100
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      origin = `http://${host}:${server.address().port}`
      server.off('error', reject)
      resolve()
    })
  })
  let closing
  return Object.freeze({
    origin,
    address: server.address(),
    close: () => {
      closing ??= new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
        server.closeAllConnections()
      })
      return closing
    }
  })
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.versions.node.split('.')[0] !== '24')
      throw new Error(
        'This candidate requires an existing Node.js 24.x installation.'
      )
    const port = parsePort(process.argv.slice(2))
    const runtime = await startLocalServer({
      root: fileURLToPath(new URL('./site/', import.meta.url)),
      port
    })
    process.stdout.write(
      `Asyra Sim local candidate: ${runtime.origin}\nOpen this address in Chrome. Press Ctrl+C to stop.\nKeep this origin unchanged for browser saves; export portable backups.\n`
    )
    for (const signal of ['SIGINT', 'SIGTERM'])
      process.once(signal, () => {
        void runtime.close()
      })
  } catch (error) {
    process.stderr.write(
      `Cannot start Asyra Sim: ${error.message}\nNo alternate port or network service was started.\n`
    )
    process.exitCode = 1
  }
}
