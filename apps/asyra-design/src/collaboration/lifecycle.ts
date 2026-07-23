import { createCollaboration, type Collaboration } from '@asyra/collaboration'
import { publishEvent } from '@asyra/reactive-events'
import { idCounter } from '@asyra/utils'
import { factory } from '../contexts'
import type { CollaborationMode } from '../render-app/collaboration-mode'
import { createDocumentCollaborationFactory } from './factory-adapter'
import { createAsyraDesignPublicationProcessor } from './operations'
import { CollaborationWebSocketProvider } from './websocket-provider'

let activeInstance: Collaboration | undefined
let startPromise:
  | Promise<NonNullable<Window['__AsyraCollaboration__']>>
  | undefined

const createHandle = (
  instance: Collaboration
): NonNullable<Window['__AsyraCollaboration__']> => ({
  identity: instance.identity,
  getStatus: () => instance.provider?.getStatus() ?? 'offline',
  disconnect: () => instance.disconnect(),
  reconnect: () => instance.reconnect(),
  whenIdle: () => instance.whenIdle(),
  dispose: () => instance.dispose()
})

const start = async (
  mode: CollaborationMode
): Promise<NonNullable<Window['__AsyraCollaboration__']>> => {
  idCounter.setNamespace(mode.actorId)
  const provider = new CollaborationWebSocketProvider({
    endpoint: mode.endpoint,
    identity: {
      documentId: mode.fileId,
      roomId: mode.fileId,
      actorId: mode.actorId,
      connectionMetadata: { fileId: mode.fileId }
    }
  })
  const processRemotePublication = createAsyraDesignPublicationProcessor(
    factory.runRemoteTransaction.bind(factory),
    (event) => factory.applyRemoteEvent(event, publishEvent)
  )
  const collaboration = createCollaboration({
    documentId: mode.fileId,
    roomId: mode.fileId,
    actorId: mode.actorId,
    factory: createDocumentCollaborationFactory(factory),
    provider,
    processRemotePublication,
    resourceOwnership: { provider: 'owned' }
  })
  activeInstance = collaboration

  try {
    const handle = createHandle(collaboration)
    window.__AsyraCollaboration__ = handle
    await collaboration.start()
    return handle
  } catch (error) {
    await collaboration.dispose().catch(() => undefined)
    if (activeInstance === collaboration) activeInstance = undefined
    delete window.__AsyraCollaboration__
    throw error
  }
}

export const startCollaboration = (
  mode: CollaborationMode
): Promise<NonNullable<Window['__AsyraCollaboration__']>> => {
  if (startPromise) return startPromise
  const pendingStart = start(mode).catch((error) => {
    startPromise = undefined
    throw error
  })
  startPromise = pendingStart
  return pendingStart
}

export const disposeCollaboration = async (): Promise<void> => {
  const instance = activeInstance
  activeInstance = undefined
  startPromise = undefined
  delete window.__AsyraCollaboration__
  await instance?.dispose()
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => void disposeCollaboration())
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_ASYRA_DESIGN_COLLABORATION_WS_URL?: string
  }
}
