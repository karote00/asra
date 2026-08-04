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

test('E2E document database forwards ordered persistence batches to the backend materializer', async () => {
  const observed = []
  const middleware = createDocumentDatabaseMiddleware({
    materializePersistenceBatch: async (batch) => {
      observed.push(batch)
      return { durableSequence: batch.lastSequence }
    }
  })
  const server = createServer((request, response) => {
    void middleware(request, response, () => {
      response.statusCode = 404
      response.end()
    })
  })
  const origin = await listen(server)

  try {
    const batch = {
      protocolVersion: 1,
      batchId: 'batch-a',
      documentId: 'file/a',
      expectedDurableSequence: 0,
      firstSequence: 1,
      lastSequence: 1,
      entries: [
        {
          documentId: 'file/a',
          sequence: 1,
          publication: {
            publicationId: 'publication-a',
            artifactId: 'artifact-a',
            transactionId: 1,
            origin: 'action',
            mode: 'atomic',
            slices: []
          }
        }
      ]
    }
    const persisted = await globalThis.fetch(
      `${origin}/api/documents/file%2Fa/persistence-batches`,
      {
        body: JSON.stringify(batch),
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        method: 'POST'
      }
    )

    assert.equal(persisted.status, 200)
    assert.deepEqual(await persisted.json(), { durableSequence: 1 })
    assert.deepEqual(observed, [batch])
  } finally {
    await close(server)
  }
})

test('E2E document database exposes the authoritative bootstrap checkpoint contract', async () => {
  const observed = []
  const middleware = createDocumentDatabaseMiddleware({
    readBootstrapCheckpoint: async (fileId) => {
      observed.push(fileId)
      return {
        checkpoint: { elements: [{ id: 'element-a' }] },
        durableSequence: 4
      }
    }
  })
  const server = createServer((request, response) => {
    void middleware(request, response, () => {
      response.statusCode = 404
      response.end()
    })
  })
  const origin = await listen(server)

  try {
    const loaded = await globalThis.fetch(
      `${origin}/api/documents/file%2Fa/bootstrap-checkpoint`,
      {
        headers: { accept: 'application/json' }
      }
    )

    assert.equal(loaded.status, 200)
    assert.deepEqual(await loaded.json(), {
      checkpoint: { elements: [{ id: 'element-a' }] },
      durableSequence: 4
    })
    assert.deepEqual(observed, ['file/a'])
  } finally {
    await close(server)
  }
})
