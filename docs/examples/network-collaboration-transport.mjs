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
  MemoryHub,
  MemoryProvider
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

// The hub represents an app/server-owned live room and acknowledgement
// boundary. Production apps can replace it with any Provider.
export const createMemoryHub = (options = {}) => new MemoryHub(options)

// Awareness is app-owned presentation state. It never authorizes or applies a
// canonical mutation and it is absent from document publications.
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
  actorId
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
  const collaboration = createCollaboration({
    documentId,
    roomId,
    actorId,
    factory,
    provider,
    processRemotePublication: (publication) => {
      const deliveryEntries = publication.slices.flatMap((slice) =>
        slice.batches.flatMap((batch) =>
          batch.deliveries.map((delivery) => ({
            channel: batch.channel,
            delivery
          }))
        )
      )
      if (
        deliveryEntries.length === 0 ||
        deliveryEntries.some(
          ({ channel, delivery }) =>
            channel !== CHANNEL ||
            delivery.eventName !== SET_VALUE ||
            !isSetValuePayload(delivery.payload)
        )
      ) {
        throw new Error('Unsupported counter publication')
      }
      factory.runRemoteTransaction(() => {
        deliveryEntries.forEach(({ delivery }) =>
          recordAndApply(delivery.payload)
        )
      })
    },
    resourceOwnership: { provider: 'owned' }
  })
  const remotePresence = new Map()
  const stopPresenceProjection = projectRemotePresence(
    collaboration.awareness,
    remotePresence
  )

  // Construction is inert. start() is the explicit live-connection point.
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
