import { AwarenessRuntime } from '@asyra/collaboration'

// Awareness is an optional, app-owned presentation input. It is not document
// state and must not be used to authorize or apply canonical mutations.
export const projectRemotePresence = (awareness, present) =>
  awareness.observe((event) => {
    if (event.type === 'updated') {
      present.set(event.snapshot.actorId, event.snapshot.state)
      return
    }
    present.delete(event.actorId)
  })

export const createAwarenessExample = ({ actorId, present = new Map() }) => {
  const awareness = new AwarenessRuntime({ actorId })
  const stopProjection = projectRemotePresence(awareness, present)

  return Object.freeze({
    awareness,
    present,
    updateLocalPresence: (state) => awareness.updateLocal(state),
    stopProjection
  })
}
