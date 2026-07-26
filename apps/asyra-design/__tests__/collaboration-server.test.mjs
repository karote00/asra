import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
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

const loadCompactBinaryCodec = async () => {
  const { createServer: createViteServer } = await import('vite')
  const moduleServer = await createViteServer({
    root: appDir,
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true }
  })
  try {
    const codec = await moduleServer.ssrLoadModule(
      '/src/collaboration/compact-binary.ts'
    )
    return {
      decode: codec.decodeCompactBinary,
      encode: codec.encodeCompactBinary
    }
  } finally {
    await moduleServer.close()
  }
}

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

const startServer = ({ port, origin, profile = false }) => {
  const environment = {
    ...process.env,
    ASYRA_DESIGN_COLLABORATION_WS_PORT: String(port)
  }
  if (profile) {
    environment.ASYRA_DESIGN_COLLABORATION_PROFILE = '1'
  } else {
    delete environment.ASYRA_DESIGN_COLLABORATION_PROFILE
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

const waitForStdoutLine = (child, prefix) =>
  new Promise((resolve, reject) => {
    let buffered = ''
    const timeout = setTimeout(
      () => reject(new Error(`${prefix} stdout timeout`)),
      5_000
    )
    const onData = (chunk) => {
      buffered += chunk.toString()
      const lines = buffered.split(/\r?\n/)
      buffered = lines.pop() ?? ''
      const line = lines.find((candidate) => candidate.startsWith(prefix))
      if (!line) return
      clearTimeout(timeout)
      child.stdout.off('data', onData)
      resolve(line)
    }
    child.stdout.on('data', onData)
  })

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

test('public reference server acknowledges and broadcasts one ordered publication batch', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4320'
  const child = startServer({ port, origin, profile: true })
  const sockets = []
  const publication = (publicationId, transactionId) => ({
    publicationId,
    transactionId,
    origin: 'action',
    deliveries: [
      {
        deliveryId: `${publicationId}:delivery`,
        transactionId,
        origin: 'action',
        kind: 'forward',
        channel: 'scene',
        eventName: 'set-value',
        payload: { value: transactionId },
        sharedDelivery: 'immediate'
      }
    ]
  })
  const publications = [
    publication('publication-a', 1),
    publication('publication-b', 2)
  ]

  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'batch-file',
      actorId: 'actor-a'
    })
    sockets.push(sender)
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'batch-file',
      actorId: 'actor-b'
    })
    sockets.push(peer)
    const response = waitForMessage(
      sender,
      (message) =>
        message.type === 'response' && message.requestId === 'actor-a:batch-1',
      'publication batch response'
    )
    const inbound = waitForMessage(
      peer,
      (message) => message.type === 'publications',
      'publication batch delivery'
    )
    const profileLine = waitForStdoutLine(
      child,
      'AI_COLLABORATION_SERVER_PROFILE '
    )

    sender.send(
      JSON.stringify({
        type: 'send-publications',
        requestId: 'actor-a:batch-1',
        publications
      })
    )

    assert.deepEqual(await response, {
      type: 'response',
      requestId: 'actor-a:batch-1',
      ok: true
    })
    assert.deepEqual(await inbound, {
      type: 'publications',
      publications,
      fromActorId: 'actor-a'
    })
    const profile = JSON.parse(
      (await profileLine).slice('AI_COLLABORATION_SERVER_PROFILE '.length)
    )
    assert.equal(profile.type, 'send-publications')
    assert.equal(profile.publicationCount, 2)
    assert.ok(profile.frameBytes > 0)
    ;[
      'queueWaitMs',
      'wireDecodeMs',
      'protocolValidateMs',
      'providerMs',
      'peerEncodeMs',
      'peerSendMs',
      'ackEncodeMs',
      'ackSendMs',
      'totalMs'
    ].forEach((field) => {
      assert.equal(Number.isFinite(profile[field]), true, field)
      assert.ok(profile[field] >= 0, field)
    })
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('public reference server preserves adjacent publication request boundaries while acknowledging each request', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4322'
  const child = startServer({ port, origin })
  const sockets = []
  const publication = (index) => ({
    publicationId: `publication-${index}`,
    transactionId: 1,
    origin: 'action',
    deliveries: [
      {
        deliveryId: `publication-${index}:delivery`,
        transactionId: 1,
        origin: 'action',
        kind: 'forward',
        channel: 'scene',
        eventName: 'set-value',
        payload: { value: index },
        sharedDelivery: 'immediate'
      }
    ]
  })
  const publications = [1, 2, 3, 4].map(publication)

  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'adjacent-request-file',
      actorId: 'actor-a'
    })
    sockets.push(sender)
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'adjacent-request-file',
      actorId: 'actor-b'
    })
    sockets.push(peer)

    const responses = new Promise((resolve, reject) => {
      const received = []
      const timeout = setTimeout(
        () => reject(new Error('adjacent publication responses timeout')),
        5_000
      )
      const onMessage = (data) => {
        const message = JSON.parse(data.toString())
        if (message.type !== 'response') return
        received.push(message)
        if (received.length !== publications.length) return
        clearTimeout(timeout)
        sender.off('message', onMessage)
        resolve(received)
      }
      sender.on('message', onMessage)
    })
    const inbound = new Promise((resolve, reject) => {
      const received = []
      const timeout = setTimeout(
        () => reject(new Error('adjacent publication delivery timeout')),
        5_000
      )
      const onMessage = (data) => {
        const message = JSON.parse(data.toString())
        if (!['publication', 'publications'].includes(message.type)) return
        received.push(message)
        const publicationCount = received.reduce(
          (total, item) =>
            total +
            (item.type === 'publications' ? item.publications.length : 1),
          0
        )
        if (publicationCount < publications.length) return
        clearTimeout(timeout)
        peer.off('message', onMessage)
        resolve(received)
      }
      peer.on('message', onMessage)
    })

    publications.forEach((item, index) => {
      sender.send(
        JSON.stringify({
          type: 'send-publication',
          requestId: `actor-a:adjacent-${index + 1}`,
          publication: item
        })
      )
    })

    assert.deepEqual(
      await inbound,
      publications.map((item) => ({
        type: 'publication',
        publication: item,
        fromActorId: 'actor-a'
      }))
    )
    assert.deepEqual(
      await responses,
      publications.map((_, index) => ({
        type: 'response',
        requestId: `actor-a:adjacent-${index + 1}`,
        ok: true
      }))
    )
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('public reference server does not coalesce different source transaction actions', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4323'
  const child = startServer({ port, origin })
  const sockets = []
  const publication = (transactionId) => ({
    publicationId: `publication-${transactionId}`,
    transactionId,
    origin: 'action',
    deliveries: [
      {
        deliveryId: `publication-${transactionId}:delivery`,
        transactionId,
        origin: 'action',
        kind: 'forward',
        channel: 'scene',
        eventName: 'set-value',
        payload: { value: transactionId },
        sharedDelivery: 'immediate'
      }
    ]
  })
  const publications = [publication(1), publication(2)]

  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'separate-action-file',
      actorId: 'actor-a'
    })
    sockets.push(sender)
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'separate-action-file',
      actorId: 'actor-b'
    })
    sockets.push(peer)
    const inboundMessages = new Promise((resolve, reject) => {
      const received = []
      const timeout = setTimeout(
        () => reject(new Error('separate action publications timeout')),
        5_000
      )
      const onMessage = (data) => {
        const message = JSON.parse(data.toString())
        if (!['publication', 'publications'].includes(message.type)) return
        received.push(message)
        const messagePublications =
          message.type === 'publications'
            ? message.publications
            : [message.publication]
        const mixedSourceActions =
          new Set(
            messagePublications.map(
              (item) => `${item.origin}:${item.transactionId}`
            )
          ).size > 1
        const receivedCount = received.reduce(
          (total, item) =>
            total +
            (item.type === 'publications' ? item.publications.length : 1),
          0
        )
        if (!mixedSourceActions && receivedCount < publications.length) return
        clearTimeout(timeout)
        peer.off('message', onMessage)
        resolve(received)
      }
      peer.on('message', onMessage)
    })

    publications.forEach((item, index) => {
      sender.send(
        JSON.stringify({
          type: 'send-publication',
          requestId: `actor-a:separate-${index + 1}`,
          publication: item
        })
      )
    })

    const received = await inboundMessages
    assert.deepEqual(
      received.map((message) =>
        message.type === 'publications'
          ? message.publications.map(
              (item) => `${item.origin}:${item.transactionId}`
            )
          : [
              `${message.publication.origin}:${message.publication.transactionId}`
            ]
      ),
      [['action:1'], ['action:2']]
    )
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('public reference server accepts a lossless binary publication batch and preserves its boundaries and order', async () => {
  const { decode, encode } = await loadCompactBinaryCodec()
  const port = await getAvailablePort()
  const origin = 'http://localhost:4324'
  const child = startServer({ port, origin })
  const sockets = []
  const publication = (transactionId) => ({
    publicationId: `binary-publication-${transactionId}`,
    transactionId,
    origin: 'action',
    deliveries: [1, 2].map((deliveryIndex) => ({
      deliveryId: `binary-publication-${transactionId}:delivery-${deliveryIndex}`,
      transactionId,
      origin: 'action',
      kind: 'forward',
      channel: 'props',
      eventName: 'addProperty',
      payload: {
        action: 'addProperty',
        data: Array.from({ length: 768 }, (_, index) => ({
          id: `binary-${transactionId}-${deliveryIndex}-${index}`,
          type: 'vectorSegment',
          startId: `binary-${transactionId}-${deliveryIndex}-${index}`,
          endId: `binary-${transactionId}-${deliveryIndex}-${index + 1}`,
          networkId: `binary-network-${transactionId}`
        })),
        eventName: 'addProperty'
      },
      sharedDelivery: 'immediate'
    }))
  })
  const publications = [publication(1), publication(2)]
  const request = {
    type: 'send-publications',
    requestId: 'actor-a:binary-batch-1',
    publications
  }
  const encodedRequest = encode(request)

  assert.ok(encodedRequest instanceof Uint8Array)
  assert.ok(
    encodedRequest.byteLength < Buffer.byteLength(JSON.stringify(request))
  )

  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'binary-batch-file',
      actorId: 'actor-a'
    })
    sockets.push(sender)
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'binary-batch-file',
      actorId: 'actor-b'
    })
    sockets.push(peer)

    const response = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('binary publication response timeout')),
        5_000
      )
      const onMessage = (data, isBinary) => {
        const message = isBinary ? decode(data) : JSON.parse(data.toString())
        if (
          message.type !== 'response' ||
          message.requestId !== request.requestId
        ) {
          return
        }
        clearTimeout(timeout)
        sender.off('message', onMessage)
        resolve(message)
      }
      sender.on('message', onMessage)
      sender.once('close', (code, reason) => {
        clearTimeout(timeout)
        reject(
          new Error(
            `binary publication response closed (${code}): ${reason.toString()}`
          )
        )
      })
    })
    const inbound = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('binary publication delivery timeout')),
        5_000
      )
      const onMessage = (data, isBinary) => {
        if (!isBinary) return
        const message = decode(data)
        if (message.type !== 'publications') return
        clearTimeout(timeout)
        peer.off('message', onMessage)
        resolve({ isBinary, message })
      }
      peer.on('message', onMessage)
    })

    sender.send(encodedRequest, { binary: true })

    const [acknowledgement, delivery] = await Promise.all([response, inbound])
    assert.deepEqual(acknowledgement, {
      type: 'response',
      requestId: request.requestId,
      ok: true
    })
    assert.equal(delivery.isBinary, true)
    assert.deepEqual(delivery.message, {
      type: 'publications',
      publications,
      fromActorId: 'actor-a'
    })
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('public reference server compacts a large publication without changing its route', async () => {
  const { decode } = await loadCompactBinaryCodec()
  const port = await getAvailablePort()
  const origin = 'http://localhost:4321'
  const child = startServer({ port, origin })
  const sockets = []
  const pointIds = Array.from(
    { length: 1024 },
    (_, index) => `vector-point-${String(index).padStart(6, '0')}`
  )
  const publication = {
    publicationId: 'publication-large',
    transactionId: 1,
    origin: 'action',
    deliveries: [
      {
        deliveryId: 'publication-large:delivery',
        transactionId: 1,
        origin: 'action',
        kind: 'forward',
        channel: 'props',
        eventName: 'addProperty',
        payload: {
          action: 'addProperty',
          data: pointIds.map((id, index) => ({
            id,
            type: 'vectorSegment',
            startId: id,
            endId: pointIds[(index + 1) % pointIds.length],
            networkId: 'vector-network-shared'
          })),
          eventName: 'addProperty'
        },
        sharedDelivery: 'immediate'
      }
    ]
  }

  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'compact-file',
      actorId: 'actor-a'
    })
    sockets.push(sender)
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'compact-file',
      actorId: 'actor-b'
    })
    sockets.push(peer)
    const response = waitForMessage(
      sender,
      (message) =>
        message.type === 'response' &&
        message.requestId === 'actor-a:compact-1',
      'compact publication response'
    )
    const compactInbound = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('compact publication delivery timeout')),
        5_000
      )
      const onMessage = (data, isBinary) => {
        if (!isBinary) return
        const message = decode(data)
        if (message.type !== 'publication') return
        clearTimeout(timeout)
        peer.off('message', onMessage)
        resolve({ encodedByteLength: data.byteLength, message })
      }
      peer.on('message', onMessage)
    })

    sender.send(
      JSON.stringify({
        type: 'send-publication',
        requestId: 'actor-a:compact-1',
        publication
      })
    )

    assert.deepEqual(await response, {
      type: 'response',
      requestId: 'actor-a:compact-1',
      ok: true
    })
    const { encodedByteLength, message } = await compactInbound
    const plain = JSON.stringify({
      type: 'publication',
      publication,
      fromActorId: 'actor-a'
    })
    assert.ok(encodedByteLength < Buffer.byteLength(plain) * 0.7)
    assert.deepEqual(message, {
      type: 'publication',
      publication,
      fromActorId: 'actor-a'
    })
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})
