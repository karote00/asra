import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { execFile, spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import process from 'node:process'
import test, { before } from 'node:test'
import { clearTimeout, setTimeout } from 'node:timers'
import { fileURLToPath, URL } from 'node:url'
import { promisify, TextDecoder, TextEncoder } from 'node:util'
import { WebSocket } from 'ws'

const appDir = fileURLToPath(new URL('../', import.meta.url))
const compiledServerPath = 'dist/collaboration-server/collaboration-server.js'
const execFileAsync = promisify(execFile)

before(async () => {
  if (
    process.env.ASYRA_DESIGN_COLLABORATION_SERVER_FOCUSED_TEST_BUILD === '1'
  ) {
    await execFileAsync(
      'yarn',
      ['tsc', '-p', 'tsconfig.collaboration-server.json', '--noEmit'],
      { cwd: appDir }
    )
    await execFileAsync(
      'yarn',
      ['vite', 'build', '--config', 'vite.collaboration-server.config.ts'],
      { cwd: appDir }
    )
    return
  }
  await execFileAsync('yarn', ['build:collaboration-server'], { cwd: appDir })
})

test('reference server is a TypeScript build with an opaque uncompressed publication route', async () => {
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
  assert.doesNotMatch(source, /MemoryHub|MemoryProvider/)
  assert.doesNotMatch(
    source,
    /\bdecodeCollaborationMessage\b|\bdecodePublicationMessageFrames\b/
  )
  assert.doesNotMatch(source, /from ['"]vite['"]|ssrLoadModule/)
  assert.match(
    source,
    /const webSocketServerOptions = \{(?=[^}]*\bnoServer:\s*true)(?=[^}]*\bmaxPayload:\s*0)(?=[^}]*\bperMessageDeflate:\s*false)[^}]*\}/s
  )
  assert.match(source, /new WebSocketServer\(webSocketServerOptions\)/)
  assert.match(
    source,
    /PEER_QUEUE_HIGH_WATERMARK_BYTES\s*=\s*2\s*\*\s*1024\s*\*\s*1024/
  )
  assert.match(source, /PEER_QUEUE_LOW_WATERMARK_BYTES\s*=\s*512\s*\*\s*1024/)
  assert.match(source, /SOURCE_FRAME_ADMITTED/)
  assert.doesNotMatch(source, /\bsocket\.(?:pause|resume)\s*\(/)
  assert.doesNotMatch(
    source,
    /\bPendingInboundPublicationFrame\b|\bpendingInboundFrames\b/
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

const createServerProbeImport = ({
  holdPeerWriteCallbacks = false,
  injectPeerWriteCallbackError = false
} = {}) => {
  const source = `
    import { createRequire } from 'node:module'

    const require = createRequire(process.cwd() + '/collaboration-server-probe.cjs')
    const { WebSocket } = require('ws')
    const originalSend = WebSocket.prototype.send
    const heldCallbacks = []
    let releasePermits = 0
    let stdinBuffer = ''

    const flushHeldCallbacks = () => {
      while (releasePermits > 0 && heldCallbacks.length > 0) {
        releasePermits -= 1
        const release = heldCallbacks.shift()
        release()
        console.log('AI_COLLABORATION_SERVER_TEST_CALLBACK_RELEASED')
      }
    }

    if (${holdPeerWriteCallbacks}) {
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', (chunk) => {
        stdinBuffer += chunk
        const commands = stdinBuffer.split(/\\r?\\n/)
        stdinBuffer = commands.pop() ?? ''
        for (const command of commands) {
          if (command === 'release') releasePermits += 1
        }
        flushHeldCallbacks()
      })
    }

    WebSocket.prototype.send = function (data, options, callback) {
      if (typeof callback !== 'function' || typeof data === 'string') {
        return Reflect.apply(originalSend, this, arguments)
      }
      return originalSend.call(this, data, options, (error) => {
        if (${injectPeerWriteCallbackError}) {
          callback(error ?? new Error('injected peer write callback failure'))
          return
        }
        if (!${holdPeerWriteCallbacks}) {
          callback(error)
          return
        }
        heldCallbacks.push(() => callback(error))
        flushHeldCallbacks()
      })
    }
  `
  return `data:text/javascript,${encodeURIComponent(source)}`
}

const startServer = ({
  port,
  origin,
  profile = false,
  holdPeerWriteCallbacks = false,
  injectPeerWriteCallbackError = false
}) => {
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
  const useProbe = holdPeerWriteCallbacks || injectPeerWriteCallbackError
  const nodeArguments = useProbe
    ? [
        '--import',
        createServerProbeImport({
          holdPeerWriteCallbacks,
          injectPeerWriteCallbackError
        }),
        compiledServerPath
      ]
    : [compiledServerPath]
  return spawn(process.execPath, nodeArguments, {
    cwd: appDir,
    env: environment,
    stdio: [useProbe ? 'pipe' : 'ignore', 'pipe', 'pipe']
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

const releasePeerWriteCallback = async (child) => {
  const released = waitForStdoutLine(
    child,
    'AI_COLLABORATION_SERVER_TEST_CALLBACK_RELEASED'
  )
  child.stdin.write('release\n')
  await released
}

const stopServer = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  await new Promise((resolve) => child.once('exit', resolve))
}

const rawDataToBuffer = (data) =>
  Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data)

const waitForMessage = (socket, predicate, description) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`${description} timeout`)),
      5_000
    )
    const onMessage = (data, isBinary) => {
      if (isBinary) return
      const message = JSON.parse(rawDataToBuffer(data).toString('utf8'))
      if (!predicate(message)) return
      clearTimeout(timeout)
      socket.off('message', onMessage)
      resolve(message)
    }
    socket.on('message', onMessage)
  })

const waitForBinaryMessage = (socket, description) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`${description} timeout`)),
      5_000
    )
    const onMessage = (data, isBinary) => {
      if (!isBinary) return
      clearTimeout(timeout)
      socket.off('message', onMessage)
      resolve(rawDataToBuffer(data))
    }
    socket.on('message', onMessage)
  })

const expectNoBinaryMessage = (socket, durationMs = 100) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('message', onMessage)
      resolve()
    }, durationMs)
    const onMessage = (_data, isBinary) => {
      if (!isBinary) return
      clearTimeout(timeout)
      socket.off('message', onMessage)
      reject(new Error('unexpected binary message'))
    }
    socket.on('message', onMessage)
  })

const noMessageBefore = async (promise, durationMs = 100) => {
  const marker = Symbol('no-message')
  const result = await Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(marker), durationMs))
  ])
  assert.equal(result, marker)
}

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
  return { socket, result: await ready }
}

const connectPublicClient = async (identity) => {
  const { socket, result } = await requestPublicClient(identity)
  assert.deepEqual(result, { type: 'ready' })
  return socket
}

const closeSocket = async (socket) => {
  if (
    !socket ||
    socket.readyState === WebSocket.CLOSED ||
    socket.readyState === WebSocket.CLOSING
  ) {
    return
  }
  const closed = new Promise((resolve) => socket.once('close', resolve))
  socket.close()
  await closed
}

const publicationFrameMagic = new Uint8Array([
  0x41, 0x53, 0x59, 0x52, 0x41, 0x50
])
const publicationFrameFixedHeaderBytes = 44

const encodeFrameString = (value) => {
  const utf8 = new TextEncoder().encode(value)
  const output = new Uint8Array(utf8.byteLength + 1)
  output[0] = 0
  output.set(utf8, 1)
  return output
}

const decodeFrameString = (bytes) => {
  if (bytes.byteLength === 0) return ''
  if (bytes[0] === 0) return new TextDecoder().decode(bytes.subarray(1))
  assert.equal(bytes[0], 1)
  assert.equal((bytes.byteLength - 1) % 2, 0)
  let value = ''
  for (let offset = 1; offset < bytes.byteLength; offset += 2) {
    value += String.fromCharCode(
      (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8)
    )
  }
  return value
}

const createOpaquePublicationFrame = ({
  requestId,
  publicationId,
  payload,
  publicationIndex = 0,
  publicationCount = 1,
  chunkIndex = 0,
  chunkCount = 1
}) => {
  const requestIdBytes = encodeFrameString(requestId)
  const publicationIdBytes = encodeFrameString(publicationId)
  const headerByteLength =
    publicationFrameFixedHeaderBytes +
    requestIdBytes.byteLength +
    publicationIdBytes.byteLength
  const bytes = new Uint8Array(headerByteLength + payload.byteLength)
  bytes.set(publicationFrameMagic, 0)
  bytes[6] = 1
  bytes[7] = publicationCount === 1 ? 1 : 2
  const view = new DataView(bytes.buffer)
  view.setUint32(8, headerByteLength, true)
  view.setUint32(12, payload.byteLength, true)
  view.setUint32(16, publicationIndex, true)
  view.setUint32(20, publicationCount, true)
  view.setUint32(24, chunkIndex, true)
  view.setUint32(28, chunkCount, true)
  view.setUint32(32, requestIdBytes.byteLength, true)
  view.setUint32(36, publicationIdBytes.byteLength, true)
  view.setUint32(40, 0, true)
  bytes.set(requestIdBytes, publicationFrameFixedHeaderBytes)
  bytes.set(
    publicationIdBytes,
    publicationFrameFixedHeaderBytes + requestIdBytes.byteLength
  )
  bytes.set(payload, headerByteLength)
  return bytes
}

const inspectOpaquePublicationFrame = (data) => {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerByteLength = view.getUint32(8, true)
  const requestIdByteLength = view.getUint32(32, true)
  const publicationIdByteLength = view.getUint32(36, true)
  const fromActorIdByteLength = view.getUint32(40, true)
  const publicationIdOffset =
    publicationFrameFixedHeaderBytes + requestIdByteLength
  const fromActorIdOffset = publicationIdOffset + publicationIdByteLength
  const requestId = decodeFrameString(
    bytes.subarray(
      publicationFrameFixedHeaderBytes,
      publicationFrameFixedHeaderBytes + requestIdByteLength
    )
  )
  const publicationId = decodeFrameString(
    bytes.subarray(
      publicationIdOffset,
      publicationIdOffset + publicationIdByteLength
    )
  )
  const fromActorId = decodeFrameString(
    bytes.subarray(fromActorIdOffset, fromActorIdOffset + fromActorIdByteLength)
  )
  const publicationIndex = view.getUint32(16, true)
  const chunkIndex = view.getUint32(24, true)
  const messageType = {
    1: 'send-publication',
    2: 'send-publications',
    3: 'publication',
    4: 'publications'
  }[bytes[7]]
  assert.ok(messageType)
  let identityKind = 'anonymous'
  if (requestId) {
    identityKind = 'request'
  } else if (fromActorId) {
    identityKind = 'actor'
  }
  const identity = requestId || fromActorId
  const lengthPrefixed = (value) => `${String(value.length)}:${value}`
  return {
    kind: bytes[7],
    requestId,
    requestIdByteLength,
    publicationId,
    fromActorId,
    publicationIndex,
    publicationCount: view.getUint32(20, true),
    chunkIndex,
    chunkCount: view.getUint32(28, true),
    frameByteLength: bytes.byteLength,
    frameId: [
      messageType,
      identityKind,
      lengthPrefixed(identity),
      lengthPrefixed(publicationId),
      publicationIndex,
      chunkIndex
    ].join('|'),
    payload: bytes.slice(headerByteLength)
  }
}

let creditSequence = 0
const sendFrameConsumed = (socket, frame, override = {}) => {
  socket.send(
    JSON.stringify({
      type: 'frame-consumed',
      requestId: `test-credit:${++creditSequence}`,
      frameId: frame.frameId,
      publicationId: frame.publicationId,
      frameByteLength: frame.frameByteLength,
      ...override
    })
  )
}

const responseFor = (socket, requestId) =>
  waitForMessage(
    socket,
    (message) => message.type === 'response' && message.requestId === requestId,
    `response for ${requestId}`
  )

const expectedSourceFrameAdmission = (frame) => {
  const inspected = inspectOpaquePublicationFrame(frame)
  return {
    type: 'source-frame-admitted',
    requestId: inspected.requestId,
    frameId: inspected.frameId,
    publicationId: inspected.publicationId,
    frameByteLength: inspected.frameByteLength
  }
}

const sourceFrameAdmissionFor = (socket, frame, description) => {
  const expected = expectedSourceFrameAdmission(frame)
  return waitForMessage(
    socket,
    (message) => message.type === expected.type,
    description ?? `source admission for ${expected.requestId}`
  )
}

const sendPublicationFrameAndWaitForAdmission = async (
  socket,
  frame,
  description
) => {
  const admitted = sourceFrameAdmissionFor(socket, frame, description)
  socket.send(frame, { binary: true })
  const message = await admitted
  assert.deepEqual(message, expectedSourceFrameAdmission(frame))
  return message
}

test('public reference server accepts app-defined fileId without credentials and loads app environment', async () => {
  const port = await getAvailablePort()
  const child = startServer({ port, origin: 'http://localhost:4317' })
  let socket
  try {
    await waitForServer(child)
    socket = await connectPublicClient({
      port,
      origin: 'http://localhost:4317',
      fileId: 'public-test-file',
      actorId: 'public-test-actor'
    })
    assert.equal(child.exitCode, null)
  } finally {
    await closeSocket(socket)
    await stopServer(child)
  }

  const envPort = await getAvailablePort()
  const envChild = startServer({ port: envPort })
  try {
    await waitForServer(envChild)
    assert.equal(envChild.exitCode, null)
  } finally {
    await stopServer(envChild)
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

test('public reference server routes JSON Awareness by fileId and reports peer disconnect', async () => {
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
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'shared-file',
      actorId: 'actor-b'
    })
    const isolated = await connectPublicClient({
      port,
      origin,
      fileId: 'isolated-file',
      actorId: 'actor-c'
    })
    sockets.push(first, peer, isolated)

    const awareness = waitForMessage(
      peer,
      (message) => message.type === 'awareness',
      'same-file Awareness'
    )
    const response = responseFor(first, 'actor-a:1')
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
      'same-file disconnect'
    )
    await closeSocket(first)
    assert.deepEqual(await disconnected, {
      type: 'awareness-disconnect',
      actorId: 'actor-a',
      reason: 'disconnect'
    })
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('peer-applied remains a distinct acknowledged server receipt', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4329'
  const child = startServer({ port, origin, profile: true })
  const sockets = []
  try {
    await waitForServer(child)
    const source = await connectPublicClient({
      port,
      origin,
      fileId: 'peer-applied-file',
      actorId: 'peer-applied-source'
    })
    const receiver = await connectPublicClient({
      port,
      origin,
      fileId: 'peer-applied-file',
      actorId: 'peer-applied-receiver'
    })
    sockets.push(source, receiver)
    const receiptEvidence = waitForStdoutLine(
      child,
      'AI_COLLABORATION_SERVER_PEER_APPLIED '
    )
    const response = responseFor(receiver, 'peer-applied-request')

    receiver.send(
      JSON.stringify({
        type: 'peer-applied',
        requestId: 'peer-applied-request',
        publicationId: 'publication-a',
        fromActorId: 'peer-applied-source'
      })
    )

    assert.deepEqual(await response, {
      type: 'response',
      requestId: 'peer-applied-request',
      ok: true
    })
    const evidence = JSON.parse(
      (await receiptEvidence).slice(
        'AI_COLLABORATION_SERVER_PEER_APPLIED '.length
      )
    )
    assert.deepEqual(evidence, {
      requestId: 'peer-applied-request',
      publicationId: 'publication-a',
      fromActorId: 'peer-applied-source',
      appliedByActorId: 'peer-applied-receiver'
    })
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('public reference server relays opaque publication payload bytes and bypasses a stalled binary queue for JSON controls', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4320'
  const child = startServer({ port, origin })
  const sockets = []
  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'opaque-file',
      actorId: 'opaque-actor-a'
    })
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'opaque-file',
      actorId: 'opaque-actor-b'
    })
    sockets.push(sender, peer)
    assert.equal(sender.extensions, '')
    assert.equal(peer.extensions, '')

    const sentinelPayload = new Uint8Array([
      0xff, 0x00, 0x71, 0x12, 0xc3, 0x28, 0xde, 0xad, 0xbe, 0xef
    ])
    const relayed = waitForBinaryMessage(peer, 'opaque publication relay')
    const accepted = responseFor(sender, 'opaque-request')
    const opaqueFrame = createOpaquePublicationFrame({
      requestId: 'opaque-request',
      publicationId: 'opaque-publication',
      payload: sentinelPayload
    })
    await sendPublicationFrameAndWaitForAdmission(sender, opaqueFrame)
    const received = inspectOpaquePublicationFrame(await relayed)
    assert.equal(received.kind, 3)
    assert.equal(received.requestIdByteLength, 0)
    assert.equal(received.publicationId, 'opaque-publication')
    assert.equal(received.fromActorId, 'opaque-actor-a')
    assert.deepEqual(received.payload, sentinelPayload)
    assert.deepEqual(await accepted, {
      type: 'response',
      requestId: 'opaque-request',
      ok: true
    })

    const secondAccepted = responseFor(sender, 'opaque-request-2')
    const secondOpaqueFrame = createOpaquePublicationFrame({
      requestId: 'opaque-request-2',
      publicationId: 'opaque-publication-2',
      payload: sentinelPayload
    })
    await sendPublicationFrameAndWaitForAdmission(sender, secondOpaqueFrame)
    await secondAccepted

    const awareness = waitForMessage(
      peer,
      (message) => message.type === 'awareness' && message.clock === 2,
      'Awareness bypass'
    )
    const awarenessResponse = responseFor(sender, 'opaque-awareness')
    sender.send(
      JSON.stringify({
        type: 'send-awareness',
        requestId: 'opaque-awareness',
        message: {
          actorId: 'opaque-actor-a',
          clock: 2,
          state: { cursor: null }
        }
      })
    )
    assert.deepEqual(await awareness, {
      type: 'awareness',
      actorId: 'opaque-actor-a',
      clock: 2,
      state: { cursor: null }
    })
    await awarenessResponse
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('public reference server rejects a single-publication frame kind with a multi-publication count before relay', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4326'
  const child = startServer({ port, origin })
  const sockets = []
  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'invalid-kind-file',
      actorId: 'invalid-kind-sender'
    })
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'invalid-kind-file',
      actorId: 'invalid-kind-peer'
    })
    sockets.push(sender, peer)
    const noPeerBinary = expectNoBinaryMessage(peer)
    const connectionError = waitForMessage(
      sender,
      (message) => message.type === 'connection-error',
      'invalid kind connection error'
    )
    const invalid = createOpaquePublicationFrame({
      requestId: 'invalid-kind-request',
      publicationId: 'invalid-kind-publication',
      publicationCount: 2,
      payload: new Uint8Array([0x99])
    })
    invalid[7] = 1
    sender.send(invalid, { binary: true })
    assert.deepEqual(await connectionError, {
      type: 'connection-error',
      code: 'transport-failed',
      message:
        '[collaboration] single-publication frame kind requires publicationCount 1'
    })
    await noPeerBinary
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('publication queue waits for both the socket callback and exact frame-consumed credit', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4321'
  const child = startServer({
    port,
    origin,
    holdPeerWriteCallbacks: true
  })
  const sockets = []
  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'dual-gate-file',
      actorId: 'dual-gate-sender'
    })
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'dual-gate-file',
      actorId: 'dual-gate-peer'
    })
    sockets.push(sender, peer)
    const payload = new Uint8Array([0x01, 0x02, 0x03])
    const frames = ['a', 'b', 'c'].map((suffix) =>
      createOpaquePublicationFrame({
        requestId: `dual-${suffix}`,
        publicationId: `dual-publication-${suffix}`,
        payload
      })
    )
    const acknowledgements = ['a', 'b', 'c'].map((suffix) =>
      responseFor(sender, `dual-${suffix}`)
    )
    const firstInbound = waitForBinaryMessage(peer, 'dual-gate first frame')
    for (const frame of frames) {
      await sendPublicationFrameAndWaitForAdmission(sender, frame)
    }
    await Promise.all(acknowledgements)
    const first = inspectOpaquePublicationFrame(await firstInbound)

    await releasePeerWriteCallback(child)
    const secondInbound = waitForBinaryMessage(peer, 'dual-gate second frame')
    sendFrameConsumed(peer, first, {
      frameByteLength: first.frameByteLength + 1
    })
    await noMessageBefore(secondInbound)
    sendFrameConsumed(peer, first)
    const second = inspectOpaquePublicationFrame(await secondInbound)

    const thirdInbound = waitForBinaryMessage(peer, 'dual-gate third frame')
    sendFrameConsumed(peer, second)
    await noMessageBefore(thirdInbound)
    await releasePeerWriteCallback(child)
    const third = inspectOpaquePublicationFrame(await thirdInbound)
    assert.equal(third.publicationId, 'dual-publication-c')
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('a second uncredited source frame fails closed and never reaches a peer', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4327'
  const child = startServer({ port, origin })
  const sockets = []
  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'source-credit-file',
      actorId: 'source-credit-sender'
    })
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'source-credit-file',
      actorId: 'source-credit-peer'
    })
    sockets.push(sender, peer)
    const payload = new Uint8Array(600 * 1024)
    const frames = [1, 2, 3, 4, 5].map((index) =>
      createOpaquePublicationFrame({
        requestId: `source-credit-${index}`,
        publicationId: `source-credit-publication-${index}`,
        payload
      })
    )
    const relayedPublicationIds = []
    peer.on('message', (data, isBinary) => {
      if (!isBinary) return
      relayedPublicationIds.push(
        inspectOpaquePublicationFrame(rawDataToBuffer(data)).publicationId
      )
    })
    const firstInbound = waitForBinaryMessage(peer, 'source-credit first frame')
    for (const frame of frames.slice(0, 3)) {
      const response = responseFor(
        sender,
        inspectOpaquePublicationFrame(frame).requestId
      )
      await sendPublicationFrameAndWaitForAdmission(sender, frame)
      await response
    }
    const first = inspectOpaquePublicationFrame(await firstInbound)

    const blockedAdmission = sourceFrameAdmissionFor(
      sender,
      frames[3],
      'blocked source frame admission'
    )
    sender.send(frames[3], { binary: true })
    await noMessageBefore(blockedAdmission)
    void blockedAdmission.catch(() => undefined)

    const connectionError = waitForMessage(
      sender,
      (message) => message.type === 'connection-error',
      'second uncredited source frame rejection'
    )
    sender.send(frames[4], { binary: true })
    assert.deepEqual(await connectionError, {
      type: 'connection-error',
      code: 'transport-failed',
      message:
        '[collaboration] multiple uncredited source publication frames are not allowed'
    })

    let current = first
    for (let index = 0; index < 2; index += 1) {
      const nextInbound = waitForBinaryMessage(
        peer,
        `source-credit queued frame ${index + 2}`
      )
      sendFrameConsumed(peer, current)
      current = inspectOpaquePublicationFrame(await nextInbound)
    }
    sendFrameConsumed(peer, current)
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.ok(!relayedPublicationIds.includes('source-credit-publication-5'))
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('bidirectional saturation keeps JSON frame-consumed credit readable without deadlock', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4328'
  const child = startServer({ port, origin })
  const sockets = []
  try {
    await waitForServer(child)
    const actorA = await connectPublicClient({
      port,
      origin,
      fileId: 'bidirectional-credit-file',
      actorId: 'bidirectional-actor-a'
    })
    const actorB = await connectPublicClient({
      port,
      origin,
      fileId: 'bidirectional-credit-file',
      actorId: 'bidirectional-actor-b'
    })
    sockets.push(actorA, actorB)

    const payload = new Uint8Array(600 * 1024)
    const actorAFrames = [1, 2, 3, 4].map((index) =>
      createOpaquePublicationFrame({
        requestId: `bidirectional-a-${index}`,
        publicationId: `bidirectional-a-publication-${index}`,
        payload
      })
    )
    const actorBFrames = [1, 2, 3, 4].map((index) =>
      createOpaquePublicationFrame({
        requestId: `bidirectional-b-${index}`,
        publicationId: `bidirectional-b-publication-${index}`,
        payload
      })
    )
    const firstForA = waitForBinaryMessage(actorA, 'first frame for actor A')
    const firstForB = waitForBinaryMessage(actorB, 'first frame for actor B')

    for (let index = 0; index < 3; index += 1) {
      const responseA = responseFor(actorA, `bidirectional-a-${index + 1}`)
      const responseB = responseFor(actorB, `bidirectional-b-${index + 1}`)
      await Promise.all([
        sendPublicationFrameAndWaitForAdmission(actorA, actorAFrames[index]),
        sendPublicationFrameAndWaitForAdmission(actorB, actorBFrames[index])
      ])
      await Promise.all([responseA, responseB])
    }

    const fourthResponseA = responseFor(actorA, 'bidirectional-a-4')
    const fourthResponseB = responseFor(actorB, 'bidirectional-b-4')
    const fourthAdmissionA = sourceFrameAdmissionFor(
      actorA,
      actorAFrames[3],
      'actor A fourth source admission'
    )
    const fourthAdmissionB = sourceFrameAdmissionFor(
      actorB,
      actorBFrames[3],
      'actor B fourth source admission'
    )
    actorA.send(actorAFrames[3], { binary: true })
    actorB.send(actorBFrames[3], { binary: true })
    await Promise.all([
      noMessageBefore(fourthAdmissionA),
      noMessageBefore(fourthAdmissionB)
    ])

    let inboundForA = inspectOpaquePublicationFrame(await firstForA)
    let inboundForB = inspectOpaquePublicationFrame(await firstForB)
    for (let index = 0; index < 3; index += 1) {
      const nextForA = waitForBinaryMessage(
        actorA,
        index === 2 ? 'fourth frame for actor A' : `queued frame for actor A`
      )
      const nextForB = waitForBinaryMessage(
        actorB,
        index === 2 ? 'fourth frame for actor B' : `queued frame for actor B`
      )
      sendFrameConsumed(actorA, inboundForA)
      sendFrameConsumed(actorB, inboundForB)
      const [nextA, nextB] = await Promise.all([nextForA, nextForB])
      inboundForA = inspectOpaquePublicationFrame(nextA)
      inboundForB = inspectOpaquePublicationFrame(nextB)
    }

    assert.deepEqual(
      await fourthAdmissionA,
      expectedSourceFrameAdmission(actorAFrames[3])
    )
    assert.deepEqual(
      await fourthAdmissionB,
      expectedSourceFrameAdmission(actorBFrames[3])
    )
    await Promise.all([fourthResponseA, fourthResponseB])
    assert.equal(inboundForA.publicationId, 'bidirectional-b-publication-4')
    assert.equal(inboundForB.publicationId, 'bidirectional-a-publication-4')
    sendFrameConsumed(actorA, inboundForA)
    sendFrameConsumed(actorB, inboundForB)
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('publication queue enforces 2 MiB high and 512 KiB low watermarks before server acceptance resumes', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4322'
  const child = startServer({ port, origin })
  const sockets = []
  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'watermark-file',
      actorId: 'watermark-sender'
    })
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'watermark-file',
      actorId: 'watermark-peer'
    })
    sockets.push(sender, peer)
    const payload = new Uint8Array(600 * 1024)
    payload[0] = 0xa1
    const frames = [1, 2, 3, 4].map((index) =>
      createOpaquePublicationFrame({
        requestId: `watermark-${index}`,
        publicationId: `watermark-publication-${index}`,
        payload
      })
    )
    assert.ok(frames[0].byteLength * 3 <= 2 * 1024 * 1024)
    assert.ok(frames[0].byteLength * 4 > 2 * 1024 * 1024)
    assert.ok(frames[0].byteLength > 512 * 1024)

    const responses = [1, 2, 3, 4].map((index) =>
      responseFor(sender, `watermark-${index}`)
    )
    const firstInbound = waitForBinaryMessage(peer, 'watermark first frame')
    for (const frame of frames.slice(0, 3)) {
      await sendPublicationFrameAndWaitForAdmission(sender, frame)
    }
    await Promise.all(responses.slice(0, 3))
    const fourthAdmission = sourceFrameAdmissionFor(
      sender,
      frames[3],
      'watermark fourth source admission'
    )
    sender.send(frames[3], { binary: true })
    await noMessageBefore(fourthAdmission)
    await noMessageBefore(responses[3])
    const first = inspectOpaquePublicationFrame(await firstInbound)

    const secondInbound = waitForBinaryMessage(peer, 'watermark second frame')
    sendFrameConsumed(peer, first)
    const second = inspectOpaquePublicationFrame(await secondInbound)
    await noMessageBefore(responses[3])

    const thirdInbound = waitForBinaryMessage(peer, 'watermark third frame')
    sendFrameConsumed(peer, second)
    const third = inspectOpaquePublicationFrame(await thirdInbound)
    await noMessageBefore(responses[3])

    const fourthInbound = waitForBinaryMessage(peer, 'watermark fourth frame')
    sendFrameConsumed(peer, third)
    assert.deepEqual(
      await fourthAdmission,
      expectedSourceFrameAdmission(frames[3])
    )
    assert.deepEqual(await responses[3], {
      type: 'response',
      requestId: 'watermark-4',
      ok: true
    })
    const fourth = inspectOpaquePublicationFrame(await fourthInbound)
    assert.equal(fourth.publicationId, 'watermark-publication-4')
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('publication queue allows one oversized frame only while the peer queue is empty', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4323'
  const child = startServer({ port, origin })
  const sockets = []
  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'oversized-file',
      actorId: 'oversized-sender'
    })
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'oversized-file',
      actorId: 'oversized-peer'
    })
    sockets.push(sender, peer)
    const normal = createOpaquePublicationFrame({
      requestId: 'oversized-normal',
      publicationId: 'oversized-normal-publication',
      payload: new Uint8Array(64 * 1024)
    })
    const oversized = createOpaquePublicationFrame({
      requestId: 'oversized-large',
      publicationId: 'oversized-large-publication',
      payload: new Uint8Array(2 * 1024 * 1024 + 64 * 1024)
    })
    const tail = createOpaquePublicationFrame({
      requestId: 'oversized-tail',
      publicationId: 'oversized-tail-publication',
      payload: new Uint8Array([0x44])
    })
    assert.ok(oversized.byteLength > 2 * 1024 * 1024)

    const normalResponse = responseFor(sender, 'oversized-normal')
    const largeResponse = responseFor(sender, 'oversized-large')
    const tailResponse = responseFor(sender, 'oversized-tail')
    const normalInbound = waitForBinaryMessage(peer, 'normal frame')
    await sendPublicationFrameAndWaitForAdmission(sender, normal)
    await normalResponse
    const largeAdmission = sourceFrameAdmissionFor(
      sender,
      oversized,
      'oversized source admission'
    )
    sender.send(oversized, { binary: true })
    await noMessageBefore(largeAdmission)
    await noMessageBefore(largeResponse)
    const receivedNormal = inspectOpaquePublicationFrame(await normalInbound)

    const largeInbound = waitForBinaryMessage(peer, 'oversized frame')
    sendFrameConsumed(peer, receivedNormal)
    assert.deepEqual(
      await largeAdmission,
      expectedSourceFrameAdmission(oversized)
    )
    await largeResponse
    const receivedLarge = inspectOpaquePublicationFrame(await largeInbound)
    assert.equal(receivedLarge.publicationId, 'oversized-large-publication')
    const tailAdmission = sourceFrameAdmissionFor(
      sender,
      tail,
      'post-oversized source admission'
    )
    sender.send(tail, { binary: true })
    await noMessageBefore(tailAdmission)
    await noMessageBefore(tailResponse)

    const tailInbound = waitForBinaryMessage(peer, 'post-oversized frame')
    sendFrameConsumed(peer, receivedLarge)
    assert.deepEqual(await tailAdmission, expectedSourceFrameAdmission(tail))
    await tailResponse
    const receivedTail = inspectOpaquePublicationFrame(await tailInbound)
    assert.equal(receivedTail.publicationId, 'oversized-tail-publication')
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('a request-start peer disconnect fails admission atomically and releases the room tail', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4324'
  const child = startServer({ port, origin })
  const sockets = []
  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'slow-peer-file',
      actorId: 'slow-peer-sender'
    })
    const fast = await connectPublicClient({
      port,
      origin,
      fileId: 'slow-peer-file',
      actorId: 'fast-peer'
    })
    const slow = await connectPublicClient({
      port,
      origin,
      fileId: 'slow-peer-file',
      actorId: 'slow-peer'
    })
    sockets.push(sender, fast, slow)

    const fastPublicationIds = []
    let resolveFastComplete
    const fastComplete = new Promise((resolve) => {
      resolveFastComplete = resolve
    })
    fast.on('message', (data, isBinary) => {
      if (!isBinary) return
      const frame = inspectOpaquePublicationFrame(rawDataToBuffer(data))
      fastPublicationIds.push(frame.publicationId)
      sendFrameConsumed(fast, frame)
      if (fastPublicationIds.length === 4) resolveFastComplete()
    })

    const payload = new Uint8Array(600 * 1024)
    const frames = [1, 2, 3, 4].map((index) =>
      createOpaquePublicationFrame({
        requestId: `slow-${index}`,
        publicationId: `slow-publication-${index}`,
        payload
      })
    )
    const responses = [1, 2, 3].map((index) =>
      responseFor(sender, `slow-${index}`)
    )
    const slowFirst = waitForBinaryMessage(slow, 'slow peer first frame')
    for (const frame of frames.slice(0, 3)) {
      await sendPublicationFrameAndWaitForAdmission(sender, frame)
    }
    await Promise.all(responses.slice(0, 3))
    const connectionError = waitForMessage(
      sender,
      (message) => message.type === 'connection-error',
      'request-start peer disconnect failure'
    )
    const senderClosed = new Promise((resolve) => sender.once('close', resolve))
    const senderControls = []
    const captureSenderControl = (data, isBinary) => {
      if (isBinary) return
      senderControls.push(JSON.parse(rawDataToBuffer(data).toString('utf8')))
    }
    sender.on('message', captureSenderControl)
    sender.send(frames[3], { binary: true })
    await slowFirst
    await noMessageBefore(connectionError)

    await closeSocket(slow)
    assert.deepEqual(await connectionError, {
      type: 'connection-error',
      code: 'transport-failed',
      message:
        '[collaboration] publication recipient disconnected before admission'
    })
    sender.off('message', captureSenderControl)
    assert.equal(
      senderControls.some(
        (message) =>
          message.type === 'source-frame-admitted' ||
          (message.type === 'response' && message.requestId === 'slow-4')
      ),
      false
    )
    await senderClosed
    await expectNoBinaryMessage(fast)

    const recoverySender = await connectPublicClient({
      port,
      origin,
      fileId: 'slow-peer-file',
      actorId: 'recovery-sender'
    })
    sockets.push(recoverySender)
    const recoveryFrame = createOpaquePublicationFrame({
      requestId: 'slow-recovery',
      publicationId: 'slow-recovery-publication',
      payload: new Uint8Array([0x5a])
    })
    const recoveryResponse = responseFor(recoverySender, 'slow-recovery')
    await sendPublicationFrameAndWaitForAdmission(recoverySender, recoveryFrame)
    await recoveryResponse
    await fastComplete
    assert.deepEqual(fastPublicationIds, [
      'slow-publication-1',
      'slow-publication-2',
      'slow-publication-3',
      'slow-recovery-publication'
    ])
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('a peer socket write callback failure removes that peer instead of fabricating frame consumption', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4325'
  const child = startServer({
    port,
    origin,
    injectPeerWriteCallbackError: true
  })
  const sockets = []
  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'write-failure-file',
      actorId: 'write-failure-sender'
    })
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'write-failure-file',
      actorId: 'write-failure-peer'
    })
    sockets.push(sender, peer)
    const closed = new Promise((resolve) => peer.once('close', resolve))
    const accepted = responseFor(sender, 'write-failure-request')
    const failingFrame = createOpaquePublicationFrame({
      requestId: 'write-failure-request',
      publicationId: 'write-failure-publication',
      payload: new Uint8Array([0xf1])
    })
    await sendPublicationFrameAndWaitForAdmission(sender, failingFrame)
    assert.deepEqual(await accepted, {
      type: 'response',
      requestId: 'write-failure-request',
      ok: true
    })
    await closed

    const afterFailure = responseFor(sender, 'after-write-failure')
    const afterFailureFrame = createOpaquePublicationFrame({
      requestId: 'after-write-failure',
      publicationId: 'after-write-failure-publication',
      payload: new Uint8Array([0xf2])
    })
    await sendPublicationFrameAndWaitForAdmission(sender, afterFailureFrame)
    assert.deepEqual(await afterFailure, {
      type: 'response',
      requestId: 'after-write-failure',
      ok: true
    })
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})
