/* global fetch */
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const test = require('node:test')
const { startServer, parseLocalUrl } = require('../server.cjs')
const root = path.resolve(__dirname, '../../../..')
test('URL contract rejects remote hosts and missing configuration', () => {
  for (const url of [
    undefined,
    'http://0.0.0.0:4318',
    'https://127.0.0.1:4318',
    'http://127.0.0.1:4318/other'
  ])
    assert.throws(() => parseLocalUrl(url))
})
test('HTTP rejects unauthorized, cross-origin, and arbitrary commands before execution', async () => {
  const parent = path.join(root, 'tmp/flow-inspector/server-tests')
  fs.mkdirSync(parent, { recursive: true })
  const directory = fs.mkdtempSync(path.join(parent, 'store-'))
  const server = await startServer(root, {
    url: 'http://127.0.0.1:0',
    serviceOptions: { directory }
  })
  try {
    const session = await fetch(server.origin + '/api/session').then(
      (response) => response.json()
    )
    const post = (body, headers = {}) =>
      fetch(server.origin + '/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body)
      })
    assert.equal((await post({})).status, 403)
    assert.equal(
      (
        await post(
          {},
          {
            'x-proof-capability': session.capability,
            origin: 'https://untrusted.example'
          }
        )
      ).status,
      403
    )
    assert.equal(
      (
        await post(
          { command: 'anything' },
          { 'x-proof-capability': session.capability }
        )
      ).status,
      400
    )
    assert.equal(
      (
        await post(
          { scenario: 'x'.repeat(5000) },
          { 'x-proof-capability': session.capability }
        )
      ).status,
      413
    )
    const hostStatus = await new Promise((resolve, reject) => {
      http
        .get(
          server.origin + '/api/state',
          { headers: { Host: 'untrusted.example' } },
          (response) => {
            response.resume()
            resolve(response.statusCode)
          }
        )
        .on('error', reject)
    })
    assert.equal(hostStatus, 403)
    assert.equal(
      (await fetch(server.origin + '/../../package.json')).status,
      404
    )
    assert.deepEqual(server.service.state().runs, [])
    const response = await post(
      {},
      { 'x-proof-capability': session.capability, origin: server.origin }
    )
    assert.equal(response.status, 202)
    const { id } = await response.json()
    const record = await server.service.wait(id)
    assert.equal(record.evidence.status, 'passed')
    const saved = await fetch(server.origin + '/api/runs/' + id).then(
      (response) => response.json()
    )
    assert.equal(saved.snapshot.digest, record.snapshot.digest)
  } finally {
    await server.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
