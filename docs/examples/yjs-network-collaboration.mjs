/**
 * Executable workspace example.
 *
 * Run with:
 * yarn workspace @asyra/collaboration example:collaboration
 *
 * Direct Node execution is not the supported monorepo resolution path; the
 * workspace runner resolves the same public package imports apps consume.
 */
import { Factory, LocalSharedDataChannel } from '@asyra/factory'
import {
  createCollaboration,
  defineCanonicalOperationApply,
  MemoryHub,
  MemoryProvider,
  MemoryPersistence
} from '@asyra/collaboration'

const CHANNEL = 'document'
const SET_VALUE = 'set-value'

const isSetValuePayload = (payload) =>
  Boolean(
    payload &&
      typeof payload === 'object' &&
      typeof payload.before === 'number' &&
      typeof payload.after === 'number'
  )

// The hub represents an app/server-owned room, authentication, and durable-ack
// boundary. Production apps can replace it with any Provider.
export const createMemoryHub = (options = {}) => new MemoryHub(options)

// Awareness is app-owned presentation state. It never authorizes or applies a
// canonical mutation and it is absent from Y.Doc and update persistence.
export const projectRemotePresence = (awareness, present) =>
  awareness.observe((event) => {
    if (event.type === 'updated') {
      present.set(event.snapshot.actorId, event.snapshot.state)
      return
    }
    present.delete(event.actorId)
  })

export const createCollaboratingCounter = async ({
  hub,
  documentId,
  roomId,
  actorId,
  permissionPolicy = () => true,
  conflictPolicies = []
}) => {
  const factory = new Factory()
  factory.registerSharedDataChannel(CHANNEL, new LocalSharedDataChannel())
  const state = { value: 0 }

  factory.registerTransactionInverter(SET_VALUE, (event) => ({
    type: event.type,
    payload: {
      ...event.payload,
      before: event.payload.after,
      after: event.payload.before
    }
  }))
  factory.registerTransactionReplayHandler(SET_VALUE, (event) => {
    state.value = event.payload.after
    return true
  })

  const recordAndApply = (payload) => {
    factory.updateTransaction({
      type: 'updateTransaction',
      eventName: SET_VALUE,
      payload,
      options: {
        undoable: true,
        rollbackable: true,
        shared: CHANNEL,
        sharedDelivery: 'transaction-end'
      }
    })
    state.value = payload.after
  }

  const provider = new MemoryProvider(hub, {
    documentId,
    roomId,
    actorId
  })
  const persistence = new MemoryPersistence()
  const collaboration = createCollaboration({
    documentId,
    roomId,
    actorId,
    factory,
    provider,
    persistence,
    operationDefinitions: [
      {
        channel: CHANNEL,
        eventName: SET_VALUE,
        schemaVersion: 1,
        validate: isSetValuePayload,
        apply: defineCanonicalOperationApply((envelope) => {
          recordAndApply(envelope.payload)
          return true
        })
      }
    ],
    permissionPolicy,
    conflictPolicies,
    resourceOwnership: {
      provider: 'owned',
      persistence: 'owned'
    }
  })
  const remotePresence = new Map()
  const stopPresenceProjection = projectRemotePresence(
    collaboration.awareness,
    remotePresence
  )

  // Construction is inert. start() is the explicit connection/recovery point.
  await collaboration.start()

  return Object.freeze({
    collaboration,
    factory,
    remotePresence,
    getValue: () => state.value,
    setValue: (after) => {
      factory.startTransaction()
      recordAndApply({ before: state.value, after })
      factory.endTransaction()
    },
    undo: () => factory.undo(),
    redo: () => factory.redo(),
    updatePresence: (presence) => collaboration.updateAwareness(presence),
    disconnect: () => collaboration.disconnect(),
    reconnect: () => collaboration.reconnect(),
    dispose: async () => {
      stopPresenceProjection()
      await collaboration.dispose()
    }
  })
}
