import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { execFile, spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer as createHttpBackendServer } from 'node:http'
import { createServer } from 'node:net'
import process from 'node:process'
import test, { after, before } from 'node:test'
import { clearTimeout, setTimeout } from 'node:timers'
import { fileURLToPath, URL } from 'node:url'
import { promisify, TextDecoder, TextEncoder } from 'node:util'
import { createServer as createViteServer } from 'vite'
import { WebSocket } from 'ws'

const appDir = fileURLToPath(new URL('../', import.meta.url))
const compiledServerPath = 'dist/collaboration-server/collaboration-server.js'
const execFileAsync = promisify(execFile)
let protocolTestRuntime
let encodeProtocolPublicationFrames
let inspectProtocolPublicationFrame
let defaultPersistenceBackend
let defaultPersistenceBackendURL

const createTransportCheckpointDocument = () => ({
  version: '1.0.0',
  sceneTree: {
    workspace: 'workspace',
    workspaceList: ['workspace'],
    elements: {
      workspace: {
        id: 'workspace',
        name: 'Workspace',
        type: 'workspace',
        parentId: '',
        visible: true,
        lock: false,
        children: []
      }
    }
  },
  props: {
    'position-a': {
      id: 'position-a',
      type: 'position',
      x: 0,
      y: 0
    }
  }
})

before(async () => {
  defaultPersistenceBackend = createHttpBackendServer(
    async (request, response) => {
      response.setHeader('content-type', 'application/json')
      if (
        request.method === 'GET' &&
        request.url?.endsWith('/bootstrap-checkpoint')
      ) {
        response.end(
          JSON.stringify({
            checkpoint: request.url.includes(
              '/documents/initial-bootstrap-file/'
            )
              ? null
              : createTransportCheckpointDocument(),
            durableSequence: 0
          })
        )
        return
      }
      if (
        request.method === 'POST' &&
        request.url?.endsWith('/persistence-batches')
      ) {
        const chunks = []
        for await (const chunk of request) chunks.push(chunk)
        const batch = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        response.end(JSON.stringify({ durableSequence: batch.lastSequence }))
        return
      }
      response.statusCode = 404
      response.end(JSON.stringify({ error: 'not found' }))
    }
  )
  await new Promise((resolve, reject) => {
    defaultPersistenceBackend.once('error', reject)
    defaultPersistenceBackend.listen(0, '127.0.0.1', resolve)
  })
  const backendAddress = defaultPersistenceBackend.address()
  assert.ok(backendAddress && typeof backendAddress === 'object')
  defaultPersistenceBackendURL = `http://127.0.0.1:${backendAddress.port}`

  if (process.env.COLLABORATION_SERVER_FOCUSED_TEST_BUILD === '1') {
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
  } else {
    await execFileAsync('yarn', ['build:collaboration-server'], { cwd: appDir })
  }
  protocolTestRuntime = await createViteServer({
    appType: 'custom',
    configFile: false,
    root: appDir,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
    ssr: { noExternal: true }
  })
  const protocol = await protocolTestRuntime.ssrLoadModule(
    '/src/collaboration/protocol.ts'
  )
  encodeProtocolPublicationFrames = protocol.encodePublicationMessageFrames
  inspectProtocolPublicationFrame = protocol.inspectPublicationFrameHeader
})

after(async () => {
  await protocolTestRuntime?.close()
  await new Promise((resolve) =>
    defaultPersistenceBackend?.close(() => resolve())
  )
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
  assert.doesNotMatch(source, /\bdecodePublicationMessageFrames\b/)
  assert.doesNotMatch(source, /\bdecodeDocumentPublication\b/)
  assert.doesNotMatch(source, /\bapplyCanonicalChangesToDocument\b/)
  assert.doesNotMatch(source, /\badmissionDocument\b/)
  assert.doesNotMatch(source, /\bisDeepStrictEqual\b/)
  assert.match(source, /createHash/)
  assert.doesNotMatch(source, /from ['"]vite['"]|ssrLoadModule/)
  assert.match(
    source,
    /const webSocketServerOptions = \{(?=[^}]*\bnoServer:\s*true)(?=[^}]*\bmaxPayload:\s*0)(?=[^}]*\bperMessageDeflate:\s*false)[^}]*\}/s
  )
  assert.match(source, /new WebSocketServer\(webSocketServerOptions\)/)
  assert.match(
    source,
    /PEER_QUEUE_CAPACITY_BYTES\s*=\s*2\s*\*\s*1024\s*\*\s*1024/
  )
  assert.doesNotMatch(source, /PEER_QUEUE_LOW_WATERMARK_BYTES/)
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
      if (!chunk.toString().includes('[collaboration]')) return
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
  injectPeerWriteCallbackError = false,
  holdPeerCloseCleanup = false
} = {}) => {
  const source = `
    import { createRequire } from 'node:module'

    const require = createRequire(process.cwd() + '/collaboration-server-probe.cjs')
    const { WebSocket } = require('ws')
    const originalSend = WebSocket.prototype.send
    const originalEmit = WebSocket.prototype.emit
    const heldCallbacks = []
    const peerSockets = new Map()
    const socketActors = new WeakMap()
    const heldCloseActors = new Set()
    const heldCloseEvents = new Map()
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

    if (${holdPeerWriteCallbacks || holdPeerCloseCleanup}) {
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', (chunk) => {
        stdinBuffer += chunk
        const commands = stdinBuffer.split(/\\r?\\n/)
        stdinBuffer = commands.pop() ?? ''
        for (const command of commands) {
          if (command === 'release') releasePermits += 1
          if (command.startsWith('hold-close:')) {
            const actorId = command.slice('hold-close:'.length)
            const socket = peerSockets.get(actorId)
            if (!socket) {
              console.log('AI_COLLABORATION_SERVER_TEST_PEER_NOT_FOUND ' + actorId)
              continue
            }
            heldCloseActors.add(actorId)
            socket.close(1000, 'test close cleanup hold')
            console.log(
              'AI_COLLABORATION_SERVER_TEST_PEER_NOT_OPEN ' +
                actorId +
                ' ' +
                socket.readyState
            )
          }
          if (command.startsWith('release-close:')) {
            const actorId = command.slice('release-close:'.length)
            const held = heldCloseEvents.get(actorId)
            if (!held) continue
            heldCloseEvents.delete(actorId)
            heldCloseActors.delete(actorId)
            Reflect.apply(originalEmit, held.socket, ['close', ...held.args])
            console.log(
              'AI_COLLABORATION_SERVER_TEST_CLOSE_RELEASED ' + actorId
            )
          }
        }
        flushHeldCallbacks()
      })
    }

    if (${holdPeerCloseCleanup}) {
      WebSocket.prototype.emit = function (eventName, ...args) {
        if (eventName === 'message') {
          const [data, isBinary] = args
          if (!isBinary) {
            try {
              const message = JSON.parse(Buffer.from(data).toString('utf8'))
              const actorId = message?.identity?.actorId
              if (message?.type === 'hello' && typeof actorId === 'string') {
                peerSockets.set(actorId, this)
                socketActors.set(this, actorId)
              }
            } catch {}
          }
        }
        const actorId = socketActors.get(this)
        if (
          eventName === 'close' &&
          actorId &&
          heldCloseActors.has(actorId)
        ) {
          heldCloseEvents.set(actorId, { socket: this, args })
          console.log('AI_COLLABORATION_SERVER_TEST_CLOSE_HELD ' + actorId)
          return false
        }
        return Reflect.apply(originalEmit, this, [eventName, ...args])
      }
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
  injectPeerWriteCallbackError = false,
  holdPeerCloseCleanup = false,
  persistenceBackendURL,
  persistenceMaxPublicationCount,
  persistenceMaxSerializedBytes = 1024 * 1024 * 1024,
  persistenceRetryIntervalMs
}) => {
  const environment = {
    ...process.env,
    COLLABORATION_WS_PORT: String(port),
    DOCUMENT_PERSISTENCE_BACKEND_URL:
      persistenceBackendURL ?? defaultPersistenceBackendURL
  }
  if (persistenceMaxPublicationCount !== undefined) {
    environment.DOCUMENT_PERSISTENCE_MAX_PUBLICATIONS = String(
      persistenceMaxPublicationCount
    )
  } else {
    delete environment.DOCUMENT_PERSISTENCE_MAX_PUBLICATIONS
  }
  environment.DOCUMENT_PERSISTENCE_MAX_SERIALIZED_BYTES = String(
    persistenceMaxSerializedBytes
  )
  if (persistenceRetryIntervalMs !== undefined) {
    environment.DOCUMENT_PERSISTENCE_RETRY_INTERVAL_MS = String(
      persistenceRetryIntervalMs
    )
  } else {
    delete environment.DOCUMENT_PERSISTENCE_RETRY_INTERVAL_MS
  }
  if (profile) {
    environment.COLLABORATION_PROFILE = '1'
  } else {
    delete environment.COLLABORATION_PROFILE
  }
  if (origin) {
    environment.APP_URL = origin
  } else {
    delete environment.APP_URL
  }
  const useProbe =
    holdPeerWriteCallbacks ||
    injectPeerWriteCallbackError ||
    holdPeerCloseCleanup
  const nodeArguments = useProbe
    ? [
        '--import',
        createServerProbeImport({
          holdPeerWriteCallbacks,
          injectPeerWriteCallbackError,
          holdPeerCloseCleanup
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

const holdPeerCloseCleanup = async (child, actorId) => {
  const notOpen = waitForStdoutLine(
    child,
    `AI_COLLABORATION_SERVER_TEST_PEER_NOT_OPEN ${actorId} `
  )
  const closeHeld = waitForStdoutLine(
    child,
    `AI_COLLABORATION_SERVER_TEST_CLOSE_HELD ${actorId}`
  )
  child.stdin.write(`hold-close:${actorId}\n`)
  await Promise.all([notOpen, closeHeld])
}

const releasePeerCloseCleanup = async (child, actorId) => {
  const released = waitForStdoutLine(
    child,
    `AI_COLLABORATION_SERVER_TEST_CLOSE_RELEASED ${actorId}`
  )
  child.stdin.write(`release-close:${actorId}\n`)
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

const waitForBinaryMessages = (socket, count, description) =>
  new Promise((resolve, reject) => {
    const messages = []
    const timeout = setTimeout(() => {
      socket.off('message', onMessage)
      reject(
        new Error(
          `${description} timeout (${messages.length}/${String(count)} received)`
        )
      )
    }, 5_000)
    const onMessage = (data, isBinary) => {
      if (!isBinary) return
      messages.push(rawDataToBuffer(data))
      if (messages.length !== count) return
      clearTimeout(timeout)
      socket.off('message', onMessage)
      resolve(messages)
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
  const socket = new WebSocket(`ws://127.0.0.1:${port}/collaboration`, {
    origin
  })
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
  assert.equal(result.type, 'ready')
  assert.ok(result.bootstrap)
  const requestId = `bootstrap-consumed:${identity.actorId}`
  const consumed = waitForMessage(
    socket,
    (message) => message.type === 'response' && message.requestId === requestId,
    `bootstrap completion for ${identity.actorId}`
  )
  socket.send(
    JSON.stringify({
      type: 'bootstrap-consumed',
      requestId,
      headSequence: result.bootstrap.headSequence
    })
  )
  assert.deepEqual(await consumed, {
    type: 'response',
    requestId,
    ok: true
  })
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

const publicationFrameFixedHeaderBytes = 52

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
  const canonical = createCanonicalPublicationFrame({
    requestId,
    publicationId,
    value: 'opaque-envelope'
  })
  const canonicalView = new DataView(
    canonical.buffer,
    canonical.byteOffset,
    canonical.byteLength
  )
  const headerByteLength = canonicalView.getUint32(8, true)
  const bytes = new Uint8Array(headerByteLength + payload.byteLength)
  bytes.set(canonical.subarray(0, headerByteLength))
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  view.setUint32(12, payload.byteLength, true)
  bytes[7] = publicationCount === 1 ? 1 : 2
  view.setUint32(16, publicationIndex, true)
  view.setUint32(20, publicationCount, true)
  view.setUint32(24, chunkIndex, true)
  view.setUint32(28, chunkCount, true)
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
  const sequence = Number(view.getBigUint64(44, true))
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
    sequence,
    frameByteLength: bytes.byteLength,
    frameId: [
      messageType,
      identityKind,
      lengthPrefixed(identity),
      lengthPrefixed(publicationId),
      publicationIndex,
      chunkIndex,
      sequence
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

const createCanonicalPropertyPublication = (publicationId, value = 1) => ({
  publicationId,
  artifactId: `artifact-${publicationId}`,
  transactionId: 1,
  origin: 'action',
  mode: 'progressive',
  slices: [
    {
      sliceId: `slice-${publicationId}`,
      orderedIds: ['position-a'],
      batches: [
        {
          batchId: `batch-${publicationId}`,
          channel: 'props',
          deliveries: [
            {
              deliveryId: `delivery-${publicationId}`,
              eventName: 'updateProperty',
              orderedIds: ['position-a'],
              payload: {
                action: 'updateProperty',
                eventName: 'updateProperty',
                id: 'position-a',
                key: 'x',
                before: typeof value === 'number' ? value - 1 : '',
                after: value
              }
            }
          ]
        }
      ]
    }
  ]
})

const createCanonicalPublicationFrame = ({
  requestId,
  publicationId,
  after = 1,
  value = after,
  targetRelayedFrameByteLength,
  fromActorId
}) => {
  let fillerLength =
    targetRelayedFrameByteLength === undefined
      ? undefined
      : Math.max(0, targetRelayedFrameByteLength - 512)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const frames = encodeProtocolPublicationFrames({
      type: 'send-publication',
      requestId,
      publication: createCanonicalPropertyPublication(
        publicationId,
        fillerLength === undefined ? value : 'x'.repeat(fillerLength)
      )
    })
    assert.equal(frames.length, 1)
    const frame = new Uint8Array(frames[0])
    if (targetRelayedFrameByteLength === undefined) return frame
    assert.ok(fromActorId)
    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength)
    const relayedFrameByteLength =
      frame.byteLength -
      view.getUint32(32, true) +
      encodeFrameString(fromActorId).byteLength
    const delta = targetRelayedFrameByteLength - relayedFrameByteLength
    if (delta === 0) return frame
    fillerLength = Math.max(0, (fillerLength ?? 0) + delta)
  }
  throw new Error('Unable to construct exact relayed publication frame')
}

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

test('single-actor handshake returns the formal sequence-zero document bootstrap', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4316'
  const child = startServer({ port, origin })
  let socket
  try {
    await waitForServer(child)
    const requested = await requestPublicClient({
      port,
      origin,
      fileId: 'initial-bootstrap-file',
      actorId: 'initial-bootstrap-actor'
    })
    socket = requested.socket
    assert.deepEqual(requested.result, {
      type: 'ready',
      bootstrap: {
        checkpoint: {
          version: '1.0.0',
          sceneTree: {
            workspace: 'workspace',
            workspaceList: ['workspace'],
            elements: {
              workspace: {
                id: 'workspace',
                name: 'Workspace',
                type: 'workspace',
                parentId: '',
                visible: true,
                lock: false,
                children: []
              }
            }
          },
          props: {}
        },
        durableSequence: 0,
        headSequence: 0,
        pendingTail: []
      }
    })
  } finally {
    await closeSocket(socket)
    await stopServer(child)
  }
})

test('bootstrap returns the gap-free pending tail and withholds post-cutoff live publications until completion', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4315'
  const child = startServer({ port, origin })
  const sockets = []
  try {
    await waitForServer(child)
    const source = await connectPublicClient({
      port,
      origin,
      fileId: 'bootstrap-cutoff-file',
      actorId: 'bootstrap-source'
    })
    sockets.push(source)

    const firstAccepted = responseFor(source, 'bootstrap-first-request')
    const firstFrame = createCanonicalPublicationFrame({
      requestId: 'bootstrap-first-request',
      publicationId: 'bootstrap-first-publication',
      after: 1
    })
    await sendPublicationFrameAndWaitForAdmission(
      source,
      firstFrame,
      'bootstrap first source admission'
    )
    assert.deepEqual(await firstAccepted, {
      type: 'response',
      requestId: 'bootstrap-first-request',
      ok: true,
      acceptedSequences: [1]
    })

    const requested = await requestPublicClient({
      port,
      origin,
      fileId: 'bootstrap-cutoff-file',
      actorId: 'bootstrap-observer'
    })
    const observer = requested.socket
    sockets.push(observer)
    assert.equal(requested.result.type, 'ready')
    assert.deepEqual(
      requested.result.bootstrap.pendingTail.map(
        ({
          sequence,
          publicationId,
          encodedPublicationFrames,
          fromActorId
        }) => ({
          sequence,
          publicationId,
          encodedFrameCount: encodedPublicationFrames.length,
          fromActorId
        })
      ),
      [
        {
          sequence: 1,
          publicationId: 'bootstrap-first-publication',
          encodedFrameCount: 1,
          fromActorId: 'bootstrap-source'
        }
      ]
    )
    assert.equal(requested.result.bootstrap.durableSequence, 0)
    assert.equal(requested.result.bootstrap.headSequence, 1)

    const noPrematureLiveFrame = expectNoBinaryMessage(observer, 150)
    const secondAccepted = responseFor(source, 'bootstrap-second-request')
    const secondFrame = createCanonicalPublicationFrame({
      requestId: 'bootstrap-second-request',
      publicationId: 'bootstrap-second-publication',
      after: 2
    })
    await sendPublicationFrameAndWaitForAdmission(
      source,
      secondFrame,
      'bootstrap second source admission'
    )
    assert.deepEqual(await secondAccepted, {
      type: 'response',
      requestId: 'bootstrap-second-request',
      ok: true,
      acceptedSequences: [2]
    })
    await noPrematureLiveFrame

    const delivered = waitForBinaryMessage(
      observer,
      'post-bootstrap live publication'
    )
    const completionRequestId = 'bootstrap-observer-consumed'
    const completion = responseFor(observer, completionRequestId)
    observer.send(
      JSON.stringify({
        type: 'bootstrap-consumed',
        requestId: completionRequestId,
        headSequence: 1
      })
    )
    assert.deepEqual(await completion, {
      type: 'response',
      requestId: completionRequestId,
      ok: true
    })
    const deliveredHeader = inspectProtocolPublicationFrame(await delivered)
    assert.equal(deliveredHeader.publicationId, 'bootstrap-second-publication')
    assert.equal(deliveredHeader.sequence, 2)

    await closeSocket(observer)
    const reconnected = await requestPublicClient({
      port,
      origin,
      fileId: 'bootstrap-cutoff-file',
      actorId: 'bootstrap-observer'
    })
    sockets.push(reconnected.socket)
    assert.equal(reconnected.result.type, 'ready')
    assert.equal(reconnected.result.bootstrap.headSequence, 2)
    assert.deepEqual(
      reconnected.result.bootstrap.pendingTail.map(
        ({ sequence, publicationId, encodedPublicationFrames }) => ({
          sequence,
          publicationId,
          encodedFrameCount: encodedPublicationFrames.length
        })
      ),
      [
        {
          sequence: 1,
          publicationId: 'bootstrap-first-publication',
          encodedFrameCount: 1
        },
        {
          sequence: 2,
          publicationId: 'bootstrap-second-publication',
          encodedFrameCount: 1
        }
      ]
    )
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
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
    const responses = Array.from({ length: 8 }, (_, index) => {
      const requestId = `peer-applied-request-${index + 1}`
      const response = responseFor(receiver, requestId)
      receiver.send(
        JSON.stringify({
          type: 'peer-applied',
          requestId,
          publicationId: `publication-${index + 1}`,
          fromActorId: 'peer-applied-source'
        })
      )
      return response
    })

    assert.deepEqual(
      await Promise.all(responses),
      Array.from({ length: 8 }, (_, index) => ({
        type: 'response',
        requestId: `peer-applied-request-${index + 1}`,
        ok: true
      }))
    )
    const evidence = JSON.parse(
      (await receiptEvidence).slice(
        'AI_COLLABORATION_SERVER_PEER_APPLIED '.length
      )
    )
    assert.deepEqual(evidence, {
      requestId: 'peer-applied-request-8',
      publicationId: 'publication-8',
      fromActorId: 'peer-applied-source',
      appliedByActorId: 'peer-applied-receiver',
      sampleCount: 8
    })
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('socket server assigns one room sequence, deduplicates publication retries, and returns only acceptance metadata', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4338'
  const child = startServer({ port, origin })
  const sockets = []
  try {
    await waitForServer(child)
    const actorA = await connectPublicClient({
      port,
      origin,
      fileId: 'sequenced-file',
      actorId: 'sequenced-actor-a'
    })
    const actorB = await connectPublicClient({
      port,
      origin,
      fileId: 'sequenced-file',
      actorId: 'sequenced-actor-b'
    })
    const observer = await connectPublicClient({
      port,
      origin,
      fileId: 'sequenced-file',
      actorId: 'sequenced-observer'
    })
    sockets.push(actorA, actorB, observer)

    const firstFrame = createCanonicalPublicationFrame({
      requestId: 'sequenced-request-a',
      publicationId: 'sequenced-publication-a',
      after: 1
    })
    const secondFrame = createCanonicalPublicationFrame({
      requestId: 'sequenced-request-b',
      publicationId: 'sequenced-publication-b',
      after: 2
    })
    const firstObserved = waitForBinaryMessage(
      observer,
      'first sequenced publication'
    )
    const firstAccepted = waitForMessage(
      actorA,
      (message) =>
        (message.type === 'response' &&
          message.requestId === 'sequenced-request-a') ||
        message.type === 'connection-error',
      'first sequenced acceptance'
    )
    actorA.send(firstFrame, { binary: true })

    assert.deepEqual(await firstAccepted, {
      type: 'response',
      requestId: 'sequenced-request-a',
      ok: true,
      acceptedSequences: [1]
    })
    const firstObservedFrame = await firstObserved
    await expectNoBinaryMessage(actorA)
    const secondObserved = waitForBinaryMessage(
      observer,
      'second sequenced publication'
    )
    const secondAccepted = waitForMessage(
      actorB,
      (message) =>
        (message.type === 'response' &&
          message.requestId === 'sequenced-request-b') ||
        message.type === 'connection-error',
      'second sequenced acceptance'
    )
    actorB.send(secondFrame, { binary: true })
    assert.deepEqual(await secondAccepted, {
      type: 'response',
      requestId: 'sequenced-request-b',
      ok: true,
      acceptedSequences: [2]
    })
    assert.deepEqual(
      [firstObservedFrame, await secondObserved].map((frame) => {
        const header = inspectProtocolPublicationFrame(frame)
        return {
          publicationId: header.publicationId,
          sequence: header.sequence
        }
      }),
      [
        { publicationId: 'sequenced-publication-a', sequence: 1 },
        { publicationId: 'sequenced-publication-b', sequence: 2 }
      ]
    )

    const retryResponse = responseFor(actorA, 'sequenced-retry-a')
    actorA.send(
      createCanonicalPublicationFrame({
        requestId: 'sequenced-retry-a',
        publicationId: 'sequenced-publication-a',
        after: 1
      }),
      { binary: true }
    )
    assert.deepEqual(await retryResponse, {
      type: 'response',
      requestId: 'sequenced-retry-a',
      ok: true,
      acceptedSequences: [1]
    })
    await expectNoBinaryMessage(observer)
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('socket server assigns order without interpreting product channels or canonical payload state', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4339'
  const child = startServer({ port, origin })
  const sockets = []
  try {
    await waitForServer(child)
    const invalidSource = await connectPublicClient({
      port,
      origin,
      fileId: 'validated-channel-file',
      actorId: 'invalid-channel-source'
    })
    const validSource = await connectPublicClient({
      port,
      origin,
      fileId: 'validated-channel-file',
      actorId: 'valid-channel-source'
    })
    const observer = await connectPublicClient({
      port,
      origin,
      fileId: 'validated-channel-file',
      actorId: 'validated-channel-observer'
    })
    sockets.push(invalidSource, validSource, observer)

    const invalidPublication = createCanonicalPropertyPublication(
      'invalid-selection-publication',
      1
    )
    invalidPublication.slices[0].batches[0].channel = 'selection'
    const invalidFrames = encodeProtocolPublicationFrames({
      type: 'send-publication',
      requestId: 'invalid-selection-request',
      publication: invalidPublication
    })
    assert.equal(invalidFrames.length, 1)
    const firstAccepted = responseFor(
      invalidSource,
      'invalid-selection-request'
    )
    const firstRelayed = waitForBinaryMessage(
      observer,
      'opaque unsupported channel relay'
    )
    invalidSource.send(invalidFrames[0], { binary: true })

    assert.deepEqual(await firstAccepted, {
      type: 'response',
      requestId: 'invalid-selection-request',
      ok: true,
      acceptedSequences: [1]
    })
    assert.equal(
      inspectProtocolPublicationFrame(await firstRelayed).sequence,
      1
    )

    const structurallyInvalidPublication = createCanonicalPropertyPublication(
      'invalid-structural-publication',
      2
    )
    structurallyInvalidPublication.slices[0].batches[0].deliveries[0].payload.id =
      'missing-position'
    const structurallyInvalidFrames = encodeProtocolPublicationFrames({
      type: 'send-publication',
      requestId: 'invalid-structural-request',
      publication: structurallyInvalidPublication
    })
    assert.equal(structurallyInvalidFrames.length, 1)
    const secondAccepted = responseFor(
      invalidSource,
      'invalid-structural-request'
    )
    const secondRelayed = waitForBinaryMessage(
      observer,
      'opaque product payload relay'
    )
    invalidSource.send(structurallyInvalidFrames[0], { binary: true })

    assert.deepEqual(await secondAccepted, {
      type: 'response',
      requestId: 'invalid-structural-request',
      ok: true,
      acceptedSequences: [2]
    })
    assert.equal(
      inspectProtocolPublicationFrame(await secondRelayed).sequence,
      2
    )

    const validFrame = createCanonicalPublicationFrame({
      requestId: 'valid-after-selection',
      publicationId: 'valid-after-selection-publication',
      after: 2
    })
    const accepted = responseFor(validSource, 'valid-after-selection')
    const relayed = waitForBinaryMessage(
      observer,
      'valid publication after unsupported channel'
    )
    validSource.send(validFrame, { binary: true })

    assert.deepEqual(await accepted, {
      type: 'response',
      requestId: 'valid-after-selection',
      ok: true,
      acceptedSequences: [3]
    })
    assert.equal(inspectProtocolPublicationFrame(await relayed).sequence, 3)
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('socket server retries the exact ordered backend batch after a non-success response', async () => {
  const requestBodies = []
  let resolveFirstFailure
  const firstFailure = new Promise((resolve) => {
    resolveFirstFailure = resolve
  })
  let resolveRetried
  const retried = new Promise((resolve) => {
    resolveRetried = resolve
  })
  let backendDurableSequence = 0
  const backend = createHttpBackendServer(async (request, response) => {
    if (
      request.method === 'GET' &&
      request.url?.endsWith('/bootstrap-checkpoint')
    ) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          checkpoint: {
            ...createTransportCheckpointDocument()
          },
          durableSequence: backendDurableSequence
        })
      )
      return
    }
    const chunks = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    requestBodies.push(Buffer.concat(chunks).toString('utf8'))
    if (requestBodies.length === 1) {
      response.writeHead(503)
      response.end()
      resolveFirstFailure()
      return
    }
    const batch = JSON.parse(requestBodies[1])
    backendDurableSequence = batch.lastSequence
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ durableSequence: batch.lastSequence }))
    resolveRetried()
  })
  await new Promise((resolve, reject) => {
    backend.once('error', reject)
    backend.listen(0, '127.0.0.1', resolve)
  })
  const backendAddress = backend.address()
  assert.ok(backendAddress && typeof backendAddress === 'object')

  const port = await getAvailablePort()
  const origin = 'http://localhost:4340'
  const child = startServer({
    port,
    origin,
    persistenceBackendURL: `http://127.0.0.1:${backendAddress.port}`,
    persistenceMaxPublicationCount: 1,
    persistenceRetryIntervalMs: 250
  })
  const sockets = []
  try {
    await waitForServer(child)
    const socket = await connectPublicClient({
      port,
      origin,
      fileId: 'backend-retry-file',
      actorId: 'backend-retry-source'
    })
    const blockedSource = await connectPublicClient({
      port,
      origin,
      fileId: 'backend-retry-file',
      actorId: 'backend-blocked-source'
    })
    sockets.push(socket, blockedSource)
    const accepted = responseFor(socket, 'backend-retry-request')
    const backendRetryFrame = createCanonicalPublicationFrame({
      requestId: 'backend-retry-request',
      publicationId: 'backend-retry-publication'
    })
    socket.send(backendRetryFrame, { binary: true })

    assert.deepEqual(await accepted, {
      type: 'response',
      requestId: 'backend-retry-request',
      ok: true,
      acceptedSequences: [1]
    })
    await firstFailure
    await new Promise((resolve) => setTimeout(resolve, 25))
    const blocked = waitForMessage(
      blockedSource,
      (message) => message.type === 'connection-error',
      'persistence failure editability block'
    )
    blockedSource.send(
      createCanonicalPublicationFrame({
        requestId: 'backend-blocked-request',
        publicationId: 'backend-blocked-publication',
        after: 2
      }),
      { binary: true }
    )
    assert.deepEqual(await blocked, {
      type: 'connection-error',
      code: 'transport-failed',
      message:
        '[collaboration] document persistence is unavailable until accepted changes are durable'
    })
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('backend retry timeout')),
        5_000
      )
      void retried.then(() => {
        clearTimeout(timeout)
        resolve()
      })
    })

    assert.equal(requestBodies.length, 2)
    assert.equal(requestBodies[1], requestBodies[0])
    assert.deepEqual(JSON.parse(requestBodies[0]), {
      protocolVersion: 1,
      batchId: 'document-persistence:backend-retry-file:1-1',
      documentId: 'backend-retry-file',
      expectedDurableSequence: 0,
      firstSequence: 1,
      lastSequence: 1,
      entries: [
        {
          documentId: 'backend-retry-file',
          sequence: 1,
          publicationId: 'backend-retry-publication',
          encodedPublicationFrames: [
            Buffer.from(backendRetryFrame).toString('base64')
          ]
        }
      ]
    })

    const recoveredSource = await connectPublicClient({
      port,
      origin,
      fileId: 'backend-retry-file',
      actorId: 'backend-recovered-source'
    })
    sockets.push(recoveredSource)
    const recovered = responseFor(recoveredSource, 'backend-recovered-request')
    recoveredSource.send(
      createCanonicalPublicationFrame({
        requestId: 'backend-recovered-request',
        publicationId: 'backend-recovered-publication',
        after: 3
      }),
      { binary: true }
    )
    assert.deepEqual(await recovered, {
      type: 'response',
      requestId: 'backend-recovered-request',
      ok: true,
      acceptedSequences: [2]
    })
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
    await new Promise((resolve) => backend.close(() => resolve()))
  }
})

test('socket server waits for durable persistence capacity without disconnecting the source', async () => {
  let resolveFirstPersistence
  const firstPersistenceReleased = new Promise((resolve) => {
    resolveFirstPersistence = resolve
  })
  let resolveFirstRequestStarted
  const firstRequestStarted = new Promise((resolve) => {
    resolveFirstRequestStarted = resolve
  })
  let persistenceRequestCount = 0
  const backend = createHttpBackendServer(async (request, response) => {
    response.setHeader('content-type', 'application/json')
    if (
      request.method === 'GET' &&
      request.url?.endsWith('/bootstrap-checkpoint')
    ) {
      response.end(
        JSON.stringify({
          checkpoint: createTransportCheckpointDocument(),
          durableSequence: 0
        })
      )
      return
    }
    const chunks = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const batch = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    persistenceRequestCount += 1
    if (persistenceRequestCount === 1) {
      resolveFirstRequestStarted()
      await firstPersistenceReleased
    }
    response.end(JSON.stringify({ durableSequence: batch.lastSequence }))
  })
  await new Promise((resolve, reject) => {
    backend.once('error', reject)
    backend.listen(0, '127.0.0.1', resolve)
  })
  const backendAddress = backend.address()
  assert.ok(backendAddress && typeof backendAddress === 'object')

  const port = await getAvailablePort()
  const origin = 'http://localhost:4341'
  const child = startServer({
    port,
    origin,
    persistenceBackendURL: `http://127.0.0.1:${backendAddress.port}`,
    persistenceMaxPublicationCount: 1
  })
  const sockets = []
  try {
    await waitForServer(child)
    const source = await connectPublicClient({
      port,
      origin,
      fileId: 'durable-capacity-file',
      actorId: 'durable-capacity-source'
    })
    sockets.push(source)

    for (const suffix of ['a', 'b']) {
      const requestId = `durable-capacity-${suffix}`
      const frame = createCanonicalPublicationFrame({
        requestId,
        publicationId: `${requestId}-publication`,
        after: suffix === 'a' ? 2 : 3
      })
      const accepted = responseFor(source, requestId)
      await sendPublicationFrameAndWaitForAdmission(source, frame)
      assert.deepEqual(await accepted, {
        type: 'response',
        requestId,
        ok: true,
        acceptedSequences: [suffix === 'a' ? 1 : 2]
      })
      if (suffix === 'a') await firstRequestStarted
    }

    const waitingRequestId = 'durable-capacity-c'
    const waitingFrame = createCanonicalPublicationFrame({
      requestId: waitingRequestId,
      publicationId: `${waitingRequestId}-publication`,
      after: 4
    })
    const waitingAdmission = sourceFrameAdmissionFor(source, waitingFrame)
    const waitingResponse = responseFor(source, waitingRequestId)
    source.send(waitingFrame, { binary: true })

    await noMessageBefore(waitingAdmission)
    await noMessageBefore(waitingResponse)
    assert.equal(source.readyState, WebSocket.OPEN)

    resolveFirstPersistence()
    assert.deepEqual(
      await waitingAdmission,
      expectedSourceFrameAdmission(waitingFrame)
    )
    assert.deepEqual(await waitingResponse, {
      type: 'response',
      requestId: waitingRequestId,
      ok: true,
      acceptedSequences: [3]
    })
    assert.equal(source.readyState, WebSocket.OPEN)
  } finally {
    resolveFirstPersistence()
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
    await new Promise((resolve) => backend.close(() => resolve()))
  }
})

test('public reference server relays opaque publication bytes and bypasses a stalled binary queue for JSON controls', async () => {
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

    const sourcePayload = new Uint8Array(10)
    const relayed = waitForBinaryMessage(peer, 'validated publication relay')
    const accepted = responseFor(sender, 'opaque-request')
    const opaqueFrame = createOpaquePublicationFrame({
      requestId: 'opaque-request',
      publicationId: 'opaque-publication',
      payload: sourcePayload
    })
    const expectedPayload = inspectOpaquePublicationFrame(opaqueFrame).payload
    await sendPublicationFrameAndWaitForAdmission(sender, opaqueFrame)
    const received = inspectOpaquePublicationFrame(await relayed)
    assert.equal(received.kind, 3)
    assert.equal(received.requestIdByteLength, 0)
    assert.equal(received.publicationId, 'opaque-publication')
    assert.equal(received.fromActorId, 'opaque-actor-a')
    assert.deepEqual(received.payload, expectedPayload)
    assert.equal(received.sequence, 1)
    assert.deepEqual(await accepted, {
      type: 'response',
      requestId: 'opaque-request',
      ok: true,
      acceptedSequences: [1]
    })

    const secondAccepted = responseFor(sender, 'opaque-request-2')
    const secondOpaqueFrame = createOpaquePublicationFrame({
      requestId: 'opaque-request-2',
      publicationId: 'opaque-publication-2',
      payload: sourcePayload
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

test('publication queue sends admitted frames before contiguous dual-gated retirement', async () => {
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
    const payload = new Uint8Array(600 * 1024)
    const frames = ['a', 'b', 'c'].map((suffix) =>
      createOpaquePublicationFrame({
        requestId: `dual-${suffix}`,
        publicationId: `dual-publication-${suffix}`,
        payload
      })
    )
    frames.push(
      createOpaquePublicationFrame({
        requestId: 'dual-d',
        publicationId: 'dual-publication-d',
        payload: new Uint8Array(1024 * 1024)
      })
    )
    const acknowledgements = ['a', 'b', 'c', 'd'].map((suffix) =>
      responseFor(sender, `dual-${suffix}`)
    )
    const admittedWindow = waitForBinaryMessages(
      peer,
      3,
      'dual-gate admitted window'
    )
    for (const frame of frames.slice(0, 3)) {
      await sendPublicationFrameAndWaitForAdmission(sender, frame)
    }
    await Promise.all(acknowledgements.slice(0, 3))
    const receivedWindow = (await admittedWindow).map(
      inspectOpaquePublicationFrame
    )
    assert.deepEqual(
      receivedWindow.map(({ publicationId }) => publicationId),
      ['dual-publication-a', 'dual-publication-b', 'dual-publication-c']
    )

    const fourthAdmission = sourceFrameAdmissionFor(
      sender,
      frames[3],
      'dual-gate fourth source admission'
    )
    const fourthInbound = waitForBinaryMessage(peer, 'dual-gate fourth frame')
    sender.send(frames[3], { binary: true })
    await noMessageBefore(fourthAdmission)

    sendFrameConsumed(peer, receivedWindow[0])
    await releasePeerWriteCallback(child)
    await noMessageBefore(fourthAdmission)

    await releasePeerWriteCallback(child)
    await noMessageBefore(fourthAdmission)
    sendFrameConsumed(peer, receivedWindow[2])
    await releasePeerWriteCallback(child)
    await noMessageBefore(fourthAdmission)

    sendFrameConsumed(peer, receivedWindow[1], {
      frameByteLength: receivedWindow[1].frameByteLength + 1
    })
    await noMessageBefore(fourthAdmission)
    sendFrameConsumed(peer, receivedWindow[1])

    assert.deepEqual(
      await fourthAdmission,
      expectedSourceFrameAdmission(frames[3])
    )
    assert.deepEqual(await acknowledgements[3], {
      type: 'response',
      requestId: 'dual-d',
      ok: true,
      acceptedSequences: [4]
    })
    const fourth = inspectOpaquePublicationFrame(await fourthInbound)
    assert.equal(fourth.publicationId, 'dual-publication-d')
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
    const admittedWindow = waitForBinaryMessages(
      peer,
      3,
      'source-credit admitted window'
    )
    for (const frame of frames.slice(0, 3)) {
      const response = responseFor(
        sender,
        inspectOpaquePublicationFrame(frame).requestId
      )
      await sendPublicationFrameAndWaitForAdmission(sender, frame)
      await response
    }
    const receivedWindow = (await admittedWindow).map(
      inspectOpaquePublicationFrame
    )
    assert.deepEqual(
      receivedWindow.map(({ publicationId }) => publicationId),
      [
        'source-credit-publication-1',
        'source-credit-publication-2',
        'source-credit-publication-3'
      ]
    )

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

    receivedWindow.forEach((frame) => sendFrameConsumed(peer, frame))
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
    const admittedForA = waitForBinaryMessages(
      actorA,
      3,
      'admitted frames for actor A'
    )
    const admittedForB = waitForBinaryMessages(
      actorB,
      3,
      'admitted frames for actor B'
    )

    for (let index = 0; index < 3; index += 1) {
      const responseA = responseFor(actorA, `bidirectional-a-${index + 1}`)
      const responseB = responseFor(actorB, `bidirectional-b-${index + 1}`)
      await Promise.all([
        sendPublicationFrameAndWaitForAdmission(actorA, actorAFrames[index]),
        sendPublicationFrameAndWaitForAdmission(actorB, actorBFrames[index])
      ])
      await Promise.all([responseA, responseB])
    }
    const receivedForA = (await admittedForA).map(inspectOpaquePublicationFrame)
    const receivedForB = (await admittedForB).map(inspectOpaquePublicationFrame)
    assert.deepEqual(
      receivedForA.map(({ publicationId }) => publicationId),
      [1, 2, 3].map((index) => `bidirectional-b-publication-${index}`)
    )
    assert.deepEqual(
      receivedForB.map(({ publicationId }) => publicationId),
      [1, 2, 3].map((index) => `bidirectional-a-publication-${index}`)
    )

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

    const fourthForA = waitForBinaryMessage(actorA, 'fourth frame for actor A')
    const fourthForB = waitForBinaryMessage(actorB, 'fourth frame for actor B')
    sendFrameConsumed(actorA, receivedForA[0])
    sendFrameConsumed(actorB, receivedForB[0])

    assert.deepEqual(
      await fourthAdmissionA,
      expectedSourceFrameAdmission(actorAFrames[3])
    )
    assert.deepEqual(
      await fourthAdmissionB,
      expectedSourceFrameAdmission(actorBFrames[3])
    )
    await Promise.all([fourthResponseA, fourthResponseB])
    const inboundForA = inspectOpaquePublicationFrame(await fourthForA)
    const inboundForB = inspectOpaquePublicationFrame(await fourthForB)
    assert.equal(inboundForA.publicationId, 'bidirectional-b-publication-4')
    assert.equal(inboundForB.publicationId, 'bidirectional-a-publication-4')
    receivedForA.slice(1).forEach((frame) => sendFrameConsumed(actorA, frame))
    receivedForB.slice(1).forEach((frame) => sendFrameConsumed(actorB, frame))
    sendFrameConsumed(actorA, inboundForA)
    sendFrameConsumed(actorB, inboundForB)
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('publication queue resumes at exact remaining 2 MiB capacity without hysteresis', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4322'
  const child = startServer({ port, origin })
  const sockets = []
  try {
    await waitForServer(child)
    const senderActorId = 'exact-capacity-sender'
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'exact-capacity-file',
      actorId: senderActorId
    })
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'exact-capacity-file',
      actorId: 'exact-capacity-peer'
    })
    sockets.push(sender, peer)
    const oneMiB = 1024 * 1024
    const createExactRelayedFrame = (suffix, targetByteLength) => {
      const publicationId = `exact-capacity-publication-${suffix}`
      return createCanonicalPublicationFrame({
        requestId: `exact-capacity-${suffix}`,
        publicationId,
        targetRelayedFrameByteLength: targetByteLength,
        fromActorId: senderActorId
      })
    }
    const frames = [
      createExactRelayedFrame('a', oneMiB),
      createExactRelayedFrame('b', oneMiB),
      createExactRelayedFrame('c', oneMiB),
      createExactRelayedFrame('d', oneMiB + 1)
    ]
    const responses = ['a', 'b', 'c', 'd'].map((suffix) =>
      responseFor(sender, `exact-capacity-${suffix}`)
    )
    const exactWindow = waitForBinaryMessages(
      peer,
      2,
      'exact-capacity admitted window'
    )
    for (const frame of frames.slice(0, 2)) {
      await sendPublicationFrameAndWaitForAdmission(sender, frame)
    }
    await Promise.all(responses.slice(0, 2))
    const receivedWindow = (await exactWindow).map(
      inspectOpaquePublicationFrame
    )
    assert.deepEqual(
      receivedWindow.map(({ frameByteLength }) => frameByteLength),
      [oneMiB, oneMiB]
    )
    assert.equal(
      receivedWindow.reduce(
        (total, { frameByteLength }) => total + frameByteLength,
        0
      ),
      2 * oneMiB
    )

    const thirdAdmission = sourceFrameAdmissionFor(
      sender,
      frames[2],
      'exact-fit source admission'
    )
    const thirdInbound = waitForBinaryMessage(peer, 'exact-fit frame')
    sender.send(frames[2], { binary: true })
    await noMessageBefore(thirdAdmission)
    sendFrameConsumed(peer, receivedWindow[0])
    assert.deepEqual(
      await thirdAdmission,
      expectedSourceFrameAdmission(frames[2])
    )
    await responses[2]
    const third = inspectOpaquePublicationFrame(await thirdInbound)
    assert.equal(third.frameByteLength, oneMiB)

    const fourthAdmission = sourceFrameAdmissionFor(
      sender,
      frames[3],
      'one-byte-over remaining-capacity source admission'
    )
    sender.send(frames[3], { binary: true })
    await noMessageBefore(fourthAdmission)
    await noMessageBefore(responses[3])

    sendFrameConsumed(peer, receivedWindow[1])
    await noMessageBefore(fourthAdmission)

    const fourthInbound = waitForBinaryMessage(
      peer,
      'one-byte-over remaining-capacity frame'
    )
    sendFrameConsumed(peer, third)
    assert.deepEqual(
      await fourthAdmission,
      expectedSourceFrameAdmission(frames[3])
    )
    assert.deepEqual(await responses[3], {
      type: 'response',
      requestId: 'exact-capacity-d',
      ok: true,
      acceptedSequences: [4]
    })
    const fourth = inspectOpaquePublicationFrame(await fourthInbound)
    assert.equal(fourth.frameByteLength, oneMiB + 1)
    sendFrameConsumed(peer, fourth)
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

test('a request-start peer socket outside OPEN is dropped without blocking source admission', async () => {
  const port = await getAvailablePort()
  const origin = 'http://localhost:4330'
  const child = startServer({
    port,
    origin,
    holdPeerCloseCleanup: true
  })
  const sockets = []
  const peerActorId = 'closing-peer'
  let closeCleanupHeld = false
  try {
    await waitForServer(child)
    const sender = await connectPublicClient({
      port,
      origin,
      fileId: 'closing-peer-file',
      actorId: 'closing-peer-sender'
    })
    const peer = await connectPublicClient({
      port,
      origin,
      fileId: 'closing-peer-file',
      actorId: peerActorId
    })
    sockets.push(sender, peer)

    await holdPeerCloseCleanup(child, peerActorId)
    closeCleanupHeld = true

    const requestId = 'closing-peer-request'
    const frame = createOpaquePublicationFrame({
      requestId,
      publicationId: 'closing-peer-publication',
      payload: new Uint8Array([0xc1])
    })
    const admitted = sourceFrameAdmissionFor(sender, frame)
    const response = responseFor(sender, requestId)

    sender.send(frame, { binary: true })

    assert.deepEqual(await admitted, expectedSourceFrameAdmission(frame))
    assert.deepEqual(await response, {
      type: 'response',
      requestId,
      ok: true,
      acceptedSequences: [1]
    })
    assert.equal(sender.readyState, WebSocket.OPEN)
  } finally {
    if (closeCleanupHeld) {
      await releasePeerCloseCleanup(child, peerActorId)
    }
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})

test('a request-start peer disconnect drops only that peer and releases healthy admission', async () => {
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
      if (fastPublicationIds.length === 5) resolveFastComplete()
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
    const fourthAdmission = sourceFrameAdmissionFor(sender, frames[3])
    const fourthResponse = responseFor(sender, 'slow-4')
    sender.send(frames[3], { binary: true })
    await slowFirst
    await noMessageBefore(fourthAdmission)

    await closeSocket(slow)
    assert.deepEqual(
      await fourthAdmission,
      expectedSourceFrameAdmission(frames[3])
    )
    assert.deepEqual(await fourthResponse, {
      type: 'response',
      requestId: 'slow-4',
      ok: true,
      acceptedSequences: [4]
    })
    assert.equal(sender.readyState, WebSocket.OPEN)

    const recoveryFrame = createOpaquePublicationFrame({
      requestId: 'slow-recovery',
      publicationId: 'slow-recovery-publication',
      payload: new Uint8Array([0x5a])
    })
    const recoveryResponse = responseFor(sender, 'slow-recovery')
    await sendPublicationFrameAndWaitForAdmission(sender, recoveryFrame)
    await recoveryResponse
    await fastComplete
    assert.deepEqual(fastPublicationIds, [
      'slow-publication-1',
      'slow-publication-2',
      'slow-publication-3',
      'slow-publication-4',
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
      ok: true,
      acceptedSequences: [1]
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
      ok: true,
      acceptedSequences: [2]
    })
  } finally {
    await Promise.all(sockets.map((socket) => closeSocket(socket)))
    await stopServer(child)
  }
})
