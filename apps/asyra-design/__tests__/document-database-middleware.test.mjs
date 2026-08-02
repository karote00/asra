import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createDocumentDatabaseMiddleware } from '../e2e/document-database-middleware.mjs'

const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('E2E document database address is unavailable'))
        return
      }
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })

test('E2E document database implements the formal file-scoped HTTP contract', async () => {
  const middleware = createDocumentDatabaseMiddleware()
  const server = createServer((request, response) => {
    void middleware(request, response, () => {
      response.statusCode = 404
      response.end()
    })
  })
  const origin = await listen(server)

  try {
    const endpoint = `${origin}/api/documents/file%2Fa`
    const initial = await globalThis.fetch(endpoint, {
      headers: { accept: 'application/json' }
    })
    assert.equal(initial.status, 200)
    assert.deepEqual(await initial.json(), { document: null })

    const document = { props: { fill: { color: '#2563EB' } } }
    const saved = await globalThis.fetch(endpoint, {
      body: JSON.stringify({ document }),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      method: 'PUT'
    })
    assert.equal(saved.status, 200)

    const loaded = await globalThis.fetch(endpoint, {
      headers: { accept: 'application/json' }
    })
    assert.deepEqual(await loaded.json(), { document })

    const cleared = await globalThis.fetch(endpoint, {
      headers: { accept: 'application/json' },
      method: 'DELETE'
    })
    assert.equal(cleared.status, 200)
    const afterClear = await globalThis.fetch(endpoint, {
      headers: { accept: 'application/json' }
    })
    assert.deepEqual(await afterClear.json(), { document: null })

    const unrelated = await globalThis.fetch(`${origin}/health`)
    assert.equal(unrelated.status, 404)
  } finally {
    await close(server)
  }
})
