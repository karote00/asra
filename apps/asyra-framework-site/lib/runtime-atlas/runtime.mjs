import core from '@asyra/core'
import factory from '@asyra/factory'
import { SessionManager } from '@asyra/feature-system'
import { runTransaction } from '@asyra/reactive-events'

import { getAtlasCase } from './case-definitions.mjs'

let fallbackRunSequence = 0

const createRunId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  fallbackRunSequence += 1
  return `atlas-run-${fallbackRunSequence}`
}

const detach = (value) => {
  if (value === undefined) {
    return undefined
  }
  return structuredClone(value)
}

const toFailure = (error) => ({
  message: error instanceof Error ? error.message : String(error),
  name: error instanceof Error ? error.name : 'UnknownError'
})

export class AtlasRuntimeUnavailableError extends Error {
  constructor(caseId) {
    super(`Runtime Atlas case is not installed: ${caseId}`)
    this.name = 'AtlasRuntimeUnavailableError'
  }
}

const createSessionExecutor = ({
  eventName,
  featureName,
  rejectAbove,
  sessionName
}) => {
  const sessions = new SessionManager()
  const state = { value: 0 }
  const initialUndoDepth = factory.getUndoHistoryDepth()
  let rejectedMessage

  factory.registerTransactionInverter(eventName, (event) => ({
    type: event.type,
    payload: {
      before: event.payload.after,
      after: event.payload.before
    }
  }))
  const stopReplay = factory.registerTransactionReplayHandler(
    eventName,
    (event) => {
      state.value = event.payload.after
      return true
    }
  )
  sessions.registerSession(
    sessionName,
    featureName,
    100,
    true,
    'rollback',
    {
      onStart: () => ({ startedAt: state.value }),
      onUpdate: (snapshot) => {
        const nextValue = Number(snapshot.nextValue)
        factory.updateTransaction({
          type: 'updateTransaction',
          eventName,
          payload: { before: state.value, after: nextValue },
          options: { rollbackable: true, undoable: true }
        })
        state.value = nextValue
        if (rejectAbove !== undefined && nextValue > rejectAbove) {
          throw new RangeError(`App limit rejects ${nextValue}`)
        }
      },
      onEnd: () => undefined,
      onCancel: () => 'rollback'
    }
  )

  return Object.freeze({
    advance: async (actionId, input) => {
      if (actionId === 'start') {
        const started = await sessions.handleStart(sessionName, {})
        return { output: { started, value: state.value } }
      }
      if (actionId.startsWith('update') || actionId === 'preview') {
        await sessions.handleUpdate(sessionName, { nextValue: input.value })
        return { output: { value: state.value } }
      }
      if (actionId === 'commit') {
        await sessions.handleEnd(sessionName, {})
        const undoDepth = factory.getUndoHistoryDepth()
        return {
          output: {
            undoDepth,
            undoDelta: undoDepth - initialUndoDepth,
            value: state.value
          }
        }
      }
      if (actionId === 'undo') {
        factory.undo()
        return { output: { value: state.value } }
      }
      if (actionId === 'redo') {
        factory.redo()
        return { output: { value: state.value } }
      }
      if (actionId === 'reject') {
        try {
          await sessions.handleUpdate(sessionName, { nextValue: input.value })
        } catch (error) {
          rejectedMessage =
            error instanceof Error ? error.message : String(error)
        }
        if (!rejectedMessage) {
          throw new Error('The invalid Atlas value was not rejected')
        }
        const undoDepth = factory.getUndoHistoryDepth()
        return {
          status: 'rejected',
          output: {
            error: rejectedMessage,
            rollbackUndoDelta: undoDepth - initialUndoDepth,
            value: state.value
          }
        }
      }
      throw new Error(`Unsupported session action: ${actionId}`)
    },
    dispose: async () => {
      await sessions.cancelActiveSessions({
        detail: { cancelledBy: 'atlas-dispose' }
      })
      sessions.unregisterSession(sessionName, featureName)
      stopReplay()
    }
  })
}

const PROJECTION_EVENT = 'atlas:projection-record-change'
const PROJECTION_FEATURE = 'atlas:approve-information-record'
const PROJECTION_KEY = 'atlas:information-record'

const isProjectionRecord = (value) =>
  Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.id === 'string' &&
      typeof value.label === 'string' &&
      typeof value.revision === 'number' &&
      (value.status === 'draft' || value.status === 'approved') &&
      value.bounds &&
      typeof value.bounds === 'object' &&
      ['x', 'y', 'width', 'height'].every(
        (key) => typeof value.bounds[key] === 'number'
      )
  )

const createProjectionExecutor = () => {
  let registration
  let stopReplay
  let registered = false

  const readRecord = () =>
    structuredClone(core.getSystemContextSnapshot()[PROJECTION_KEY])

  return Object.freeze({
    advance: async (actionId) => {
      if (actionId === 'register') {
        const initialRecord = {
          id: 'safety-review',
          label: 'Safety review',
          revision: 1,
          status: 'draft',
          bounds: { x: 72, y: 54, width: 168, height: 104 }
        }
        core.defineSystemProperty(PROJECTION_KEY, initialRecord, {
          runtime: false,
          validate: isProjectionRecord
        })
        factory.registerTransactionInverter(PROJECTION_EVENT, (event) => ({
          type: event.type,
          payload: {
            before: event.payload.after,
            after: event.payload.before
          }
        }))
        stopReplay = factory.registerTransactionReplayHandler(
          PROJECTION_EVENT,
          (event) => {
            core.setSystemProperty(PROJECTION_KEY, event.payload.after)
            return true
          }
        )
        registration = core.defineFeature(PROJECTION_FEATURE, undefined, {
          priority: 100,
          exclusive: true,
          api: {
            approve: () => {
              const before = readRecord()
              const after = {
                ...before,
                revision: before.revision + 1,
                status: 'approved'
              }
              factory.updateTransaction({
                type: 'updateTransaction',
                eventName: PROJECTION_EVENT,
                payload: { before, after },
                options: { rollbackable: true, undoable: true }
              })
              core.setSystemProperty(PROJECTION_KEY, after)
            }
          }
        })
        registered = true
        return { output: { canonical: readRecord() } }
      }
      if (actionId === 'approve') {
        if (!registration) {
          throw new Error('Projection Feature is not registered')
        }
        runTransaction(() => registration.api.approve())
        return { output: { canonical: readRecord() } }
      }
      if (actionId === 'project') {
        const canonical = readRecord()
        const serialized = await core.save()
        return {
          output: {
            canonical,
            projections: {
              canvas: canonical.bounds,
              hierarchy: [
                { id: 'workspace', label: 'Information workspace' },
                {
                  id: canonical.id,
                  label: canonical.label,
                  parentId: 'workspace'
                }
              ],
              properties: {
                revision: canonical.revision,
                status: canonical.status
              },
              serialized: serialized.systemContext?.[PROJECTION_KEY]
            }
          }
        }
      }
      throw new Error(`Unsupported projection action: ${actionId}`)
    },
    dispose: () => {
      registration?.dispose()
      stopReplay?.()
      if (registered) {
        core.unregisterSystemProperty(PROJECTION_KEY)
      }
    }
  })
}

const canonicalCaseFactories = Object.freeze({
  'continuous-pointer-undo': () =>
    createSessionExecutor({
      eventName: 'atlas:pointer-value-change',
      featureName: 'atlas:pointer-feature',
      sessionName: 'atlas:pointer-session'
    }),
  'canonical-projection-fanout': createProjectionExecutor,
  'invalid-input-rollback': () =>
    createSessionExecutor({
      eventName: 'atlas:bounded-value-change',
      featureName: 'atlas:bounded-feature',
      rejectAbove: 5,
      sessionName: 'atlas:bounded-session'
    })
})

export const createAtlasRuntimeHarness = ({ caseId, createExecutor }) => {
  const definition = getAtlasCase(caseId)
  const runId = createRunId()
  const executor = createExecutor(definition)
  const evidence = []
  let sequence = 0
  let actionIndex = 0
  let terminal = false
  let disposed = false

  const snapshot = () =>
    Object.freeze({
      actionIndex,
      caseId,
      complete: terminal && evidence.at(-1)?.status !== 'failed',
      definition,
      disposed,
      evidence: Object.freeze(evidence.map((entry) => detach(entry))),
      runId,
      sequence,
      terminal
    })

  const advance = async () => {
    if (disposed) {
      throw new Error('Runtime Atlas run is disposed')
    }
    if (terminal) {
      return snapshot()
    }

    const action = definition.actions[actionIndex]
    if (!action) {
      terminal = true
      return snapshot()
    }

    sequence += 1
    try {
      const result = await executor.advance(action.id, detach(action.input))
      const isFinal = actionIndex === definition.actions.length - 1
      evidence.push(
        Object.freeze({
          actionId: action.id,
          bypasses: definition.bypasses,
          caseId,
          conditions: definition.conditions,
          input: detach(action.input),
          label: action.label,
          output: detach(result?.output),
          owner: action.owner,
          runId,
          sequence,
          status: result?.status ?? 'completed'
        })
      )
      actionIndex += 1
      terminal = isFinal
      return snapshot()
    } catch (error) {
      evidence.push(
        Object.freeze({
          actionId: action.id,
          bypasses: definition.bypasses,
          caseId,
          conditions: definition.conditions,
          failure: toFailure(error),
          input: detach(action.input),
          label: action.label,
          owner: action.owner,
          runId,
          sequence,
          status: 'failed'
        })
      )
      terminal = true
      return snapshot()
    }
  }

  const dispose = async () => {
    if (disposed) {
      return
    }
    disposed = true
    await executor.dispose?.()
  }

  return Object.freeze({ advance, dispose, snapshot })
}

export const createAtlasCaseExecutor = (definition) => {
  const createExecutor = canonicalCaseFactories[definition.id]
  if (!createExecutor) {
    throw new AtlasRuntimeUnavailableError(definition.id)
  }
  return createExecutor()
}

export const createAtlasRuntime = (caseId) =>
  createAtlasRuntimeHarness({ caseId, createExecutor: createAtlasCaseExecutor })
