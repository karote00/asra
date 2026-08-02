import {
  createCollaboration,
  type Collaboration,
  type ProcessRemotePublication,
  type ProviderStatus
} from '@asyra/collaboration'
import type { SharedPublication } from '@asyra/factory'
import { idCounter } from '@asyra/utils'
import core, { factory } from '../contexts'
import type { CollaborationMode } from '../render-app/collaboration-mode'
import { createDocumentCollaborationFactory } from './factory-adapter'
import { createPublicationProcessor } from './operations'
import { CollaborationWebSocketProvider } from './websocket-provider'

let activeInstance: Collaboration | undefined
let activeHandle: CollaborationDebugHandle | undefined
let startPromise: Promise<CollaborationDebugHandle> | undefined

export interface CollaborationDebugHandle {
  readonly identity: Readonly<{
    readonly documentId: string
    readonly roomId: string
    readonly actorId: string
  }>
  getStatus(): ProviderStatus
  onStatusChange(subscriber: (status: ProviderStatus) => void): () => void
  disconnect(): Promise<void>
  reconnect(): Promise<void>
  whenIdle(): Promise<void>
  observePublicationOutcomes(
    subscriber: Parameters<Collaboration['observePublicationOutcomes']>[0]
  ): () => void
  dispose(): Promise<void>
}

export const getActiveCollaborationHandle = ():
  | CollaborationDebugHandle
  | undefined => activeHandle

export const createRemotePublicationHandler = (
  applyRemotePublication: (publication: SharedPublication) => boolean
): ProcessRemotePublication => {
  return async (publication) => {
    const applied = applyRemotePublication(publication)
    if (!applied) {
      throw new Error(
        `[collaboration] remote publication ${publication.publicationId} was rejected`
      )
    }
  }
}

const createHandle = (instance: Collaboration): CollaborationDebugHandle => {
  const handle = {
    identity: instance.identity,
    getStatus: () => instance.provider?.getStatus() ?? 'offline',
    onStatusChange: (subscriber: (status: ProviderStatus) => void) =>
      instance.provider?.onStatusChange(subscriber) ?? (() => undefined),
    disconnect: () => instance.disconnect(),
    reconnect: () => instance.reconnect(),
    whenIdle: () => instance.whenIdle(),
    observePublicationOutcomes: (
      subscriber: Parameters<Collaboration['observePublicationOutcomes']>[0]
    ) => instance.observePublicationOutcomes(subscriber),
    dispose: () => instance.dispose()
  }
  return handle
}

const start = async (
  mode: CollaborationMode
): Promise<CollaborationDebugHandle> => {
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
  const applyRemotePublication = createPublicationProcessor({
    runRemoteTransaction: factory.runRemoteTransaction.bind(factory),
    decideRemotePublication: (publication) => publication,
    applyCanonicalChanges: core.applyCanonicalChanges.bind(core)
  })
  const processRemotePublication = createRemotePublicationHandler(
    applyRemotePublication
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
    activeHandle = handle
    window.__Collaboration__ = handle
    await collaboration.start()
    return handle
  } catch (error) {
    await collaboration.dispose().catch(() => undefined)
    if (activeInstance === collaboration) {
      activeInstance = undefined
      activeHandle = undefined
    }
    delete window.__Collaboration__
    throw error
  }
}

export const startCollaboration = (
  mode: CollaborationMode
): Promise<CollaborationDebugHandle> => {
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
  activeHandle = undefined
  startPromise = undefined
  delete window.__Collaboration__
  await instance?.dispose()
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => void disposeCollaboration())
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_COLLABORATION_WS_URL?: string
  }
}
