/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('node:http')
const { URL } = require('node:url')
const fs = require('node:fs')
const path = require('node:path')
const { randomBytes, timingSafeEqual } = require('node:crypto')
const { createService, LOCAL_ACTOR, ActionError } = require('./service.cjs')

function parseLocalUrl(value) {
  if (!value)
    throw new Error('Set FLOW_PROOF_URL, for example http://127.0.0.1:4318')
  const url = new URL(value)
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error(
      'FLOW_PROOF_URL must be an HTTP loopback origin with an explicit port'
    )
  return url
}
const readBody = async (request) => {
  if (
    request.headers['content-type']?.split(';')[0].trim() !== 'application/json'
  )
    throw new ActionError(415, 'JSON body required')
  if (Number(request.headers['content-length']) > 4096)
    throw new ActionError(413, 'Request too large')
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 4096) throw new ActionError(413, 'Request too large')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString())
  } catch {
    throw new ActionError(400, 'Invalid JSON')
  }
}

async function startServer(
  repositoryRoot,
  { url = process.env.FLOW_PROOF_URL, serviceOptions } = {}
) {
  const address = parseLocalUrl(url)
  const service = createService(repositoryRoot, serviceOptions)
  const capability = randomBytes(32).toString('hex')
  const assets = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/board.js', ['board.js', 'text/javascript; charset=utf-8']],
    ['/board.css', ['board.css', 'text/css; charset=utf-8']]
  ])
  let origin
  let closing = false
  const server = http.createServer(
    { maxHeaderSize: 8192 },
    async (request, response) => {
      const send = (status, data) => {
        response.writeHead(status, {
          'Content-Type': 'application/json; charset=utf-8'
        })
        response.end(JSON.stringify(data))
      }
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('X-Content-Type-Options', 'nosniff')
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'"
      )
      try {
        if (closing) throw new ActionError(503, 'Service is closing')
        if (
          request.headers.host !== new URL(origin).host ||
          (request.headers.origin && request.headers.origin !== origin)
        )
          throw new ActionError(403, 'Origin is not authorized')
        const route = new URL(request.url, origin)
        if (route.search)
          throw new ActionError(400, 'Query parameters are unsupported')
        if (request.method === 'GET') {
          if (route.pathname === '/api/session')
            return send(200, { capability })
          if (route.pathname === '/api/state') return send(200, service.state())
          const match = route.pathname.match(/^\/api\/runs\/([a-f0-9-]{36})$/)
          if (match) return send(200, service.get(match[1]))
          const asset = assets.get(route.pathname)
          if (!asset) throw new ActionError(404, 'Route not found')
          response.writeHead(200, { 'Content-Type': asset[1] })
          return response.end(
            fs.readFileSync(path.join(__dirname, 'public', asset[0]))
          )
        }
        if (request.method !== 'POST')
          throw new ActionError(405, 'Method not allowed')
        const provided = request.headers['x-proof-capability']
        if (
          typeof provided !== 'string' ||
          provided.length !== capability.length ||
          !timingSafeEqual(Buffer.from(provided), Buffer.from(capability))
        )
          throw new ActionError(403, 'Action is not authorized')
        const body = await readBody(request)
        if (route.pathname === '/api/runs')
          return send(202, { id: service.start(body, LOCAL_ACTOR) })
        const cancel = route.pathname.match(
          /^\/api\/runs\/([a-f0-9-]{36})\/cancel$/
        )
        if (cancel) {
          if (
            !body ||
            typeof body !== 'object' ||
            Array.isArray(body) ||
            Object.keys(body).length
          )
            throw new ActionError(400, 'Cancellation takes an empty body')
          await service.cancel(cancel[1], LOCAL_ACTOR)
          return send(200, { id: cancel[1] })
        }
        throw new ActionError(404, 'Action not found')
      } catch (error) {
        if (!response.destroyed)
          send(error.status ?? 500, { error: error.message })
      }
    }
  )
  server.requestTimeout = 5000
  server.headersTimeout = 5000
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(Number(address.port), '127.0.0.1', resolve)
    })
    origin = 'http://127.0.0.1:' + server.address().port
  } catch (error) {
    await service.close()
    throw error
  }
  return {
    origin,
    service,
    async close() {
      closing = true
      await service.close()
      server.closeAllConnections()
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  }
}
module.exports = { startServer, parseLocalUrl }
