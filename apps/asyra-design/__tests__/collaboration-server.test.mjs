import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import process from 'node:process'
import test, { before } from 'node:test'
import { clearTimeout, setTimeout } from 'node:timers'
import { fileURLToPath, URL } from 'node:url'
import { promisify } from 'node:util'
import { WebSocket } from 'ws'

const appDir = fileURLToPath(new URL('../', import.meta.url))
const compiledServerPath = 'dist/collaboration-server/collaboration-server.js'
const execFileAsync = promisify(execFile)

before(async () => {
  await execFileAsync('yarn', ['build:collaboration-server'], { cwd: appDir })
})

test('reference server is a TypeScript build with no Vite runtime dependency', async () => {
  const source = await readFile(
    new URL('../collaboration-server.ts', import.meta.url),
    'utf8'
  )
  const providerSource = await readFile(
    new URL('../src/collaboration/websocket-provider.ts', import.meta.url),
    'utf8'
  )
  const manifest = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  )

  assert.doesNotMatch(source, /\.\.\/\.\.\/packages\/collaboration/)
  assert.match(source, /from ['"]@asyra\/collaboration['"]/)
  assert.match(source, /from ['"].*collaboration\/protocol['"]/)
  assert.match(providerSource, /from ['"].*protocol['"]/)
  assert.doesNotMatch(source, /type MessageRecord/)
  assert.doesNotMatch(providerSource, /type ServerMessage/)
  assert.doesNotMatch(source, /from ['"]vite['"]|ssrLoadModule/)
  assert.match(
    source,
    /new WebSocketServer\(\{\s*noServer:\s*true,\s*maxPayload:\s*0\s*\}\)/,
    'the local reference transport must not reject a valid finite canonical publication at the ws default 100 MiB ceiling'
  )
  assert.equal(manifest.dependencies.vite, undefined)
  assert.equal(manifest.devDependencies.vite, '^6.2.3')
  assert.match(
    manifest.scripts['build:collaboration-server'],
    /gen:turbo:check/
  )
  assert.match(
    manifest.scripts['build:collaboration-server'],
    /tsc -p tsconfig\.collaboration-server\.json/
  )
  assert.match(
    manifest.scripts['build:collaboration-server'],
    /vite build --config vite\.collaboration-server\.config\.ts/
  )
  assert.equal(
    manifest.scripts['collaboration:server'],
    `yarn build:collaboration-server && node ${compiledServerPath}`
  )
  assert.equal(
    manifest.scripts['collaboration:server:start'],
    `node ${compiledServerPath}`
  )
})

const getAvailablePort = async () => {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  return address.port
}

const waitForServer = (child) =>
  new Promise((resolve, reject) => {
    let stderr = ''
    const timeout = setTimeout(
      () => reject(new Error(`collaboration server timeout: ${stderr}`)),
      10_000
    )
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.stdout.on('data', (chunk) => {
      if (!chunk.toString().includes('[asyra-design collaboration]')) return
      clearTimeout(timeout)
      resolve()
    })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`collaboration server exited (${code}): ${stderr}`))
    })
  })

const startServer = ({ port, origin }) => {
  const environment = {
    ...process.env,
    ASYRA_DESIGN_COLLABORATION_WS_PORT: String(port)
  }
  if (origin) {
    environment.ASYRA_DESIGN_APP_URL = origin
  } else {
    delete environment.ASYRA_DESIGN_APP_URL
  }

  return spawn(process.execPath, [compiledServerPath], {
    cwd: appDir,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

const stopServer = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  await new Promise((resolve) => child.once('exit', resolve))
}

const waitForMessage = (socket, predicate, description) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`${description} timeout`)),
      5_000
    )
    const onMessage = (data) => {
      const message = JSON.parse(data.toString())
      if (!predicate(message)) return
      clearTimeout(timeout)
      socket.off('message', onMessage)
      resolve(message)
    }
    socket.on('message', onMessage)
  })

const requestPublicClient = async ({ port, origin, fileId, actorId }) => {
  const socket = new WebSocket(
    `ws://127.0.0.1:${port}/asyra-design-collaboration`,
    { origin }
  )
  const ready = waitForMessage(
    socket,
    (message) =>
      message.type === 'ready' || message.type === 'connection-error',
    `collaboration ready for ${actorId}`
  )
  await new Promise((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
  socket.send(
    JSON.stringify({
      type: 'hello',
      identity: {
        documentId: 'provider-internal-document',
        roomId: 'provider-internal-room',
        actorId,
        connectionMetadata: { fileId }
      }
    })
  )
  const result = await ready
  return { socket, result }
}

const connectPublicClient = async (identity) => {
  const { socket, result } = await requestPublicClient(identity)
  assert.deepEqual(result, { type: 'ready' })
  return socket
}

const closeSocket = async (socket) => {
  if (socket.readyState === WebSocket.CLOSED) return
  const closed = new Promise((resolve) => socket.once('close', resolve))
  socket.close()
  await closed
}

test('public reference server accepts app-defined fileId without credentials', async () => {
  const port = await getAvailablePort()
  const child = startServer({
    port,
    origin: 'http://localhost:4317'
  })
  let socket

  try {
    await waitForServer(child)
    socket = new WebSocket(
      `ws://127.0.0.1:${port}/asyra-design-collaboration`,
      { origin: 'http://localhost:4317' }
    )

    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('public collaboration hello timeout')),
        5_000
      )
      socket.once('open', () => {
        socket.send(
          JSON.stringify({
            type: 'hello',
            identity: {
              documentId: 'provider-internal-document',
              roomId: 'provider-internal-room',
              actorId: 'public-test-actor',
              connectionMetadata: { fileId: 'public-test-file' }
            }
          })
        )
      })
      socket.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type !== 'ready' && message.type !== 'connection-error') {
          return
        }
        clearTimeout(timeout)
        resolve(message)
      })
      socket.once('error', reject)
    })

    assert.deepEqual(result, { type: 'ready' })
  } finally {
    socket?.close()
    await stopServer(child)
  }
})

test('compiled server loads the app .env without a Vite runtime', async () => {
  const port = await getAvailablePort()
  const child = startServer({ port })

  try {
    await waitForServer(child)
    assert.equal(child.exitCode, null)
  } finally {
    await stopServer(child)
  }
})

test('a rejected duplicate cannot release another connection actor reservation', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4319'
  const child = startServer({ port, origin })
  const sockets = []

  try {
    await waitForServer(child)
    const owner = await connectPublicClient({
      port,
      origin,
      fileId: 'reserved-file',
      actorId: 'reserved-actor'
    })
    sockets.push(owner)

    const duplicate = await requestPublicClient({
      port,
      origin,
      fileId: 'reserved-file',
      actorId: 'reserved-actor'
    })
    sockets.push(duplicate.socket)
    assert.deepEqual(duplicate.result, {
      type: 'connection-error',
      code: 'connection-rejected',
      message: '[collaboration] actor is already connected to this room'
    })
    await closeSocket(duplicate.socket)

    const stillReserved = await requestPublicClient({
      port,
      origin,
      fileId: 'reserved-file',
      actorId: 'reserved-actor'
    })
    sockets.push(stillReserved.socket)
    assert.deepEqual(stillReserved.result, duplicate.result)
    await closeSocket(stillReserved.socket)

    await closeSocket(owner)
    const replacement = await connectPublicClient({
      port,
      origin,
      fileId: 'reserved-file',
      actorId: 'reserved-actor'
    })
    sockets.push(replacement)
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('public reference server routes Awareness by fileId and reports peer disconnect', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4318'
  const child = startServer({ port, origin })
  const sockets = []

  try {
    await waitForServer(child)
    const first = await connectPublicClient({
      port,
      origin,
      fileId: 'shared-file',
      actorId: 'actor-a'
    })
    sockets.push(first)
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'shared-file',
      actorId: 'actor-b'
    })
    sockets.push(peer)
    const isolated = await connectPublicClient({
      port,
      origin,
      fileId: 'isolated-file',
      actorId: 'actor-c'
    })
    sockets.push(isolated)

    const isolatedMessages = []
    isolated.on('message', (data) => {
      isolatedMessages.push(JSON.parse(data.toString()))
    })
    const awareness = waitForMessage(
      peer,
      (message) => message.type === 'awareness',
      'same-file Awareness delivery'
    )
    const response = waitForMessage(
      first,
      (message) =>
        message.type === 'response' && message.requestId === 'actor-a:1',
      'Awareness request response'
    )
    first.send(
      JSON.stringify({
        type: 'send-awareness',
        requestId: 'actor-a:1',
        message: {
          actorId: 'actor-a',
          clock: 1,
          state: { cursor: { x: 10, y: 20 } }
        }
      })
    )

    assert.deepEqual(await awareness, {
      type: 'awareness',
      actorId: 'actor-a',
      clock: 1,
      state: { cursor: { x: 10, y: 20 } }
    })
    assert.deepEqual(await response, {
      type: 'response',
      requestId: 'actor-a:1',
      ok: true
    })

    const disconnected = waitForMessage(
      peer,
      (message) =>
        message.type === 'awareness-disconnect' &&
        message.actorId === 'actor-a',
      'same-file Awareness disconnect'
    )
    first.close()
    assert.deepEqual(await disconnected, {
      type: 'awareness-disconnect',
      actorId: 'actor-a',
      reason: 'disconnect'
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.equal(
      isolatedMessages.some((message) =>
        ['awareness', 'awareness-disconnect'].includes(message.type)
      ),
      false
    )
  } finally {
    sockets.forEach((socket) => socket.close())
    await stopServer(child)
  }
})
