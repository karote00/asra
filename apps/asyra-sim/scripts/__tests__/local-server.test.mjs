import assert from 'node:assert/strict'
import { request } from 'node:http'
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
  symlink,
  readFile
} from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { setTimeout, clearTimeout } from 'node:timers'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import test from 'node:test'
import { parsePort, startLocalServer } from '../local-server.mjs'

const artifacts = fileURLToPath(
  new URL('../../.artifacts/server-tests/', import.meta.url)
)
async function fixture(t) {
  await mkdir(artifacts, { recursive: true })
  const directory = await mkdtemp(path.join(artifacts, 'case-'))
  const root = path.join(directory, 'site')
  await mkdir(path.join(root, 'assets'), { recursive: true })
  await writeFile(path.join(root, 'index.html'), '<main>Local candidate</main>')
  await writeFile(
    path.join(root, 'assets', 'worker.js'),
    'postMessage("ready")'
  )
  await writeFile(path.join(directory, 'private.txt'), 'not public')
  await writeFile(path.join(root, '.env'), 'not public either')
  await symlink(
    path.join(directory, 'private.txt'),
    path.join(root, 'linked.txt')
  )
  await symlink(directory, path.join(root, 'linked-directory'))
  const server = await startLocalServer({ root, port: 0 })
  t.after(async () => {
    await server.close()
    await rm(directory, { recursive: true })
  })
  return { directory, root, server }
}
function get(origin, target, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request(
      origin,
      { path: target, method: 'GET', ...options },
      (response) => {
        let text = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          text += chunk
        })
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            text
          })
        )
      }
    )
    req.on('error', reject)
    req.end()
  })
}

test('serves only the explicit loopback tree, with module MIME, HEAD, no-store and security headers', async (t) => {
  const { server } = await fixture(t)
  assert.equal(server.address.address, '127.0.0.1')
  const main = await get(server.origin, '/')
  assert.equal(main.status, 200)
  assert.equal(main.text, '<main>Local candidate</main>')
  assert.equal(main.headers['cache-control'], 'no-store')
  assert.equal(main.headers['x-content-type-options'], 'nosniff')
  assert.match(main.headers['content-security-policy'], /connect-src 'self'/)
  assert.equal(main.headers['access-control-allow-origin'], undefined)
  const worker = await get(server.origin, '/assets/worker.js?version=1')
  assert.equal(worker.headers['content-type'], 'text/javascript; charset=utf-8')
  assert.equal(worker.text, 'postMessage("ready")')
  const head = await get(server.origin, '/assets/worker.js', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(head.text, '')
  assert.equal(
    Number(head.headers['content-length']),
    Buffer.byteLength(worker.text)
  )
})

test('rejects traversal, symlinks, dotfiles, malformed URLs and directory enumeration', async (t) => {
  const { server } = await fixture(t)
  for (const target of [
    '/../private.txt',
    '/%2e%2e/private.txt',
    '/assets/../../private.txt',
    '/linked.txt',
    '/linked-directory/private.txt',
    '/.env',
    '/assets',
    '/missing.js',
    '/%252e%252e/private.txt'
  ]) {
    const response = await get(server.origin, target)
    assert.equal(response.status, 404, target)
    assert.doesNotMatch(response.text, /not public/)
  }
  for (const target of [
    '//example.test/',
    '/%00',
    '/%5c..%5cprivate.txt',
    '/%ZZ'
  ])
    assert.equal((await get(server.origin, target)).status, 400, target)
})

test('rejects remote authorities, cross-site requests, writes and request bodies', async (t) => {
  const { server } = await fixture(t)
  for (const headers of [
    { host: 'example.test' },
    { origin: 'https://example.test' },
    { 'sec-fetch-site': 'cross-site' }
  ])
    assert.equal((await get(server.origin, '/', { headers })).status, 403)
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS'])
    assert.equal((await get(server.origin, '/', { method })).status, 405)
  assert.equal(
    (await get(server.origin, '/', { headers: { 'content-length': '1' } }))
      .status,
    400
  )
  assert.equal(
    (await get(server.origin, '/', { headers: { origin: server.origin } }))
      .status,
    200
  )
})

test('fails on an occupied port, closes idempotently and allows explicit restart', async (t) => {
  const { server, root } = await fixture(t)
  const port = server.address.port
  await assert.rejects(startLocalServer({ root, port }), { code: 'EADDRINUSE' })
  await Promise.all([server.close(), server.close()])
  const replacement = await startLocalServer({ root, port })
  t.after(() => replacement.close())
  assert.equal((await get(replacement.origin, '/')).status, 200)
})

test('uses a stable default origin and refuses unsupported launch arguments or roots', async (t) => {
  assert.equal(parsePort([]), 3020)
  assert.equal(parsePort(['--port=3021']), 3021)
  for (const args of [
    ['--host=0.0.0.0'],
    ['--port=0'],
    ['--port=80'],
    ['--port=65536'],
    ['--port=3020', '--port=3021']
  ])
    assert.throws(() => parsePort(args), /Use node/)
  const { root } = await fixture(t)
  await assert.rejects(startLocalServer({ root: '.', port: 0 }), /absolute/)
  await assert.rejects(
    startLocalServer({ root: path.join(root, 'linked-directory'), port: 0 }),
    /symbolic link/
  )
})

test(
  'the standalone Node launcher ignores caller cwd and closes its owned port on SIGINT',
  { timeout: 5000 },
  async (t) => {
    const { directory, root, server } = await fixture(t)
    const port = server.address.port
    await server.close()
    const launcher = path.join(directory, 'server.mjs')
    await writeFile(
      launcher,
      await readFile(new URL('../local-server.mjs', import.meta.url))
    )
    const child = spawn(process.execPath, [launcher, `--port=${port}`], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const exited = new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code) => resolve(code))
    })
    t.after(async () => {
      if (child.exitCode === null) child.kill('SIGTERM')
      await exited
    })
    let output = '',
      errors = ''
    child.stderr.on('data', (chunk) => {
      errors += chunk
    })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Launcher timeout: ${errors}`)),
        3000
      )
      child.stdout.on('data', (chunk) => {
        output += chunk
        if (output.includes('Open this address')) {
          clearTimeout(timer)
          resolve()
        }
      })
      child.once('exit', () => {
        clearTimeout(timer)
        reject(new Error(`Launcher exited: ${errors}`))
      })
    })
    assert.match(output, new RegExp(`http://127.0.0.1:${port}`))
    assert.equal((await get(server.origin, '/')).status, 200)
    child.kill('SIGINT')
    assert.equal(await exited, 0)
    assert.equal(errors, '')
    const replacement = await startLocalServer({ root, port })
    await replacement.close()
  }
)
