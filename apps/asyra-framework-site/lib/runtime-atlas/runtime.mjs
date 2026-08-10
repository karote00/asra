import { createAiAgentRuntime } from '@asyra/ai-agent-runtime'
import {
  createCollaboration,
  MemoryHub,
  MemoryProvider
} from '@asyra/collaboration'
import core from '@asyra/core'
import factory, { Factory, LocalSharedDataChannel } from '@asyra/factory'
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
  return globalThis.structuredClone(value)
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
  sessions.registerSession(sessionName, featureName, 100, true, 'rollback', {
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
  })

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
    globalThis.structuredClone(core.getSystemContextSnapshot()[PROJECTION_KEY])

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

const COLLABORATION_CHANNEL = 'atlas-document'
const COLLABORATION_EVENT = 'atlas-set-value'

const isCollaborationPayload = (payload) =>
  Boolean(
    payload &&
      typeof payload === 'object' &&
      typeof payload.before === 'number' &&
      typeof payload.after === 'number'
  )

const createCollaborationActor = async ({ actorId, hub, onRemoteApply }) => {
  const actorFactory = new Factory()
  actorFactory.registerSharedDataChannel(
    COLLABORATION_CHANNEL,
    new LocalSharedDataChannel()
  )
  const state = { value: 0 }

  actorFactory.registerTransactionInverter(COLLABORATION_EVENT, (event) => ({
    type: event.type,
    payload: {
      before: event.payload.after,
      after: event.payload.before
    }
  }))
  actorFactory.registerTransactionReplayHandler(
    COLLABORATION_EVENT,
    (event) => {
      state.value = event.payload.after
      return true
    }
  )

  const recordAndApply = (payload) => {
    actorFactory.updateTransaction({
      type: 'updateTransaction',
      eventName: COLLABORATION_EVENT,
      payload,
      options: {
        rollbackable: true,
        shared: COLLABORATION_CHANNEL,
        sharedDelivery: 'transaction-end',
        undoable: true
      }
    })
    state.value = payload.after
  }

  const provider = new MemoryProvider(hub, {
    actorId,
    documentId: 'atlas-document',
    roomId: 'atlas-room'
  })
  const collaboration = createCollaboration({
    actorId,
    documentId: 'atlas-document',
    roomId: 'atlas-room',
    publicationSource: {
      subscribe: (subscriber) =>
        actorFactory.subscribeToSharedPublication(subscriber)
    },
    provider,
    processRemotePublication: (publication) => {
      const deliveries = publication.slices.flatMap((slice) =>
        slice.batches.flatMap((batch) =>
          batch.deliveries.map((delivery) => ({
            channel: batch.channel,
            delivery
          }))
        )
      )
      if (
        deliveries.length === 0 ||
        deliveries.some(
          ({ channel, delivery }) =>
            channel !== COLLABORATION_CHANNEL ||
            delivery.eventName !== COLLABORATION_EVENT ||
            !isCollaborationPayload(delivery.payload)
        )
      ) {
        throw new Error('Atlas App rejected an unsupported publication')
      }
      actorFactory.runRemoteTransaction(() => {
        deliveries.forEach(({ delivery }) => recordAndApply(delivery.payload))
      })
      onRemoteApply()
    },
    resourceOwnership: { provider: 'owned' }
  })
  const remotePresence = new Map()
  const stopPresence = collaboration.awareness.observe((event) => {
    if (event.type === 'updated') {
      remotePresence.set(event.snapshot.actorId, event.snapshot.state)
      return
    }
    remotePresence.delete(event.actorId)
  })
  await collaboration.start()

  return Object.freeze({
    collaboration,
    getPresence: (actor) =>
      globalThis.structuredClone(remotePresence.get(actor)),
    getValue: () => state.value,
    setValue: (after) => {
      actorFactory.startTransaction()
      recordAndApply({ before: state.value, after })
      actorFactory.endTransaction()
    },
    updatePresence: (presence) => collaboration.updateAwareness(presence),
    dispose: async () => {
      stopPresence()
      await collaboration.dispose()
    }
  })
}

const createCollaborationExecutor = () => {
  const hub = new MemoryHub()
  let first
  let second
  let remoteApplyCount = 0

  return Object.freeze({
    advance: async (actionId) => {
      if (actionId === 'connect') {
        first = await createCollaborationActor({
          actorId: 'actor-a',
          hub,
          onRemoteApply: () => {
            remoteApplyCount += 1
          }
        })
        second = await createCollaborationActor({
          actorId: 'actor-b',
          hub,
          onRemoteApply: () => {
            remoteApplyCount += 1
          }
        })
        return { output: { actors: ['actor-a', 'actor-b'], connected: true } }
      }
      if (!first || !second) {
        throw new Error('Atlas Collaboration actors are not connected')
      }
      if (actionId === 'publish') {
        first.setValue(7)
        await first.collaboration.whenIdle()
        await second.collaboration.whenIdle()
        return {
          output: {
            actorA: first.getValue(),
            actorB: second.getValue(),
            remoteApplyCount
          }
        }
      }
      if (actionId === 'presence') {
        await first.updatePresence({ tool: 'select' })
        await second.collaboration.whenIdle()
        return {
          output: {
            actorBPresence: second.getPresence('actor-a'),
            canonicalValue: second.getValue()
          }
        }
      }
      if (actionId === 'verify') {
        return {
          output: {
            actorBPresenceTool: second.getPresence('actor-a')?.tool,
            actorBValue: second.getValue(),
            durability: 'not-composed',
            remoteApplyCount
          }
        }
      }
      throw new Error(`Unsupported Collaboration action: ${actionId}`)
    },
    dispose: async () => {
      await Promise.all([first?.dispose(), second?.dispose()])
    }
  })
}

const createAiExecutor = () => {
  const state = { visible: true }
  const transactions = { commits: 0, rollbacks: 0 }
  const serverArguments = { visible: false }
  let providerRequests = 0
  let runtime
  let outcome

  return Object.freeze({
    advance: async (actionId, input) => {
      if (actionId === 'compose') {
        runtime = createAiAgentRuntime({
          provider: {
            requestActionBatch: async () => {
              providerRequests += 1
              return {
                batchId: 'atlas-ai-batch',
                explanation: 'Apply one registered action.',
                actions: [
                  {
                    arguments: serverArguments,
                    id: 'atlas-visibility-1',
                    name: 'set_visibility',
                    summary: { affectedCount: 1, kind: 'visibility' }
                  }
                ]
              }
            }
          },
          actionDefinitions: [
            {
              name: 'set_visibility',
              description: 'Set Atlas example visibility.',
              inputSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['visible'],
                properties: { visible: { type: 'boolean' } }
              },
              execute: async (args) => {
                if (args !== serverArguments) {
                  throw new Error('AI Runtime replaced prepared arguments')
                }
                state.visible = args.visible
                return { visible: state.visible }
              }
            }
          ],
          contextProvider: {
            getContext: async () => ({ currentVisibility: state.visible })
          },
          permissionPolicy: {
            evaluate: async ({ action }) => {
              if (action.arguments !== serverArguments) {
                throw new Error('Permission received different arguments')
              }
              return 'allow'
            }
          },
          confirmationHandler: { confirm: async () => false },
          transactionRunner: {
            run: async (_label, execute) => {
              try {
                const result = await execute()
                transactions.commits += 1
                return result
              } catch (error) {
                transactions.rollbacks += 1
                throw error
              }
            }
          }
        })
        return {
          output: {
            network: 'not-used',
            provider: 'app-owned deterministic provider',
            visible: state.visible
          }
        }
      }
      if (actionId === 'run') {
        if (!runtime) {
          throw new Error('Atlas AI Runtime is not composed')
        }
        outcome = await runtime.run({
          intent: String(input.intent),
          signal: new globalThis.AbortController().signal
        })
        return {
          output: {
            batchId: outcome.batchId,
            providerRequests,
            status: outcome.status,
            transactions: { ...transactions },
            visible: state.visible
          }
        }
      }
      if (actionId === 'verify') {
        return {
          output: {
            batchId: outcome?.batchId,
            network: 'not-used',
            providerRequests,
            status: outcome?.status,
            transactions: { ...transactions },
            visible: state.visible
          }
        }
      }
      throw new Error(`Unsupported AI action: ${actionId}`)
    },
    dispose: () => runtime?.dispose()
  })
}

const RETRIEVAL_EVENT = 'atlas:retrieval-record-change'
const RETRIEVAL_FEATURE = 'atlas:record-status-action'
const RETRIEVAL_KEY = 'atlas:retrieval-records'

const createRetrievalExecutor = () => {
  let registration
  let stopReplay
  let matches = []
  let beforeSearch

  const readRecords = () =>
    globalThis.structuredClone(core.getSystemContextSnapshot()[RETRIEVAL_KEY])

  return Object.freeze({
    advance: (actionId, input) => {
      if (actionId === 'register') {
        core.defineSystemProperty(
          RETRIEVAL_KEY,
          {
            'record-a': { label: 'Cooling audit', status: 'open' },
            'record-b': { label: 'Safety review', status: 'open' }
          },
          { runtime: true }
        )
        factory.registerTransactionInverter(RETRIEVAL_EVENT, (event) => ({
          type: event.type,
          payload: {
            before: event.payload.after,
            after: event.payload.before
          }
        }))
        stopReplay = factory.registerTransactionReplayHandler(
          RETRIEVAL_EVENT,
          (event) => {
            core.setSystemProperty(RETRIEVAL_KEY, event.payload.after)
            return true
          }
        )
        registration = core.defineFeature(RETRIEVAL_FEATURE, undefined, {
          priority: 100,
          exclusive: true,
          api: {
            setStatus: (recordId, status) => {
              const before = readRecords()
              const after = {
                ...before,
                [recordId]: { ...before[recordId], status }
              }
              factory.updateTransaction({
                type: 'updateTransaction',
                eventName: RETRIEVAL_EVENT,
                payload: { before, after },
                options: { rollbackable: true, undoable: true }
              })
              core.setSystemProperty(RETRIEVAL_KEY, after)
            }
          }
        })
        return { output: { canonical: readRecords() } }
      }
      if (actionId === 'retrieve') {
        const query = String(input.query).toLowerCase()
        beforeSearch = readRecords()
        matches = Object.entries(beforeSearch)
          .filter(([, record]) => record.label.toLowerCase().includes(query))
          .map(([id, record]) => ({ id, ...record }))
        const afterSearch = readRecords()
        return {
          output: {
            canonicalUnchanged:
              JSON.stringify(beforeSearch) === JSON.stringify(afterSearch),
            matches
          }
        }
      }
      if (actionId === 'approve') {
        if (!registration || matches.length !== 1) {
          throw new Error('Atlas retrieval did not resolve one record')
        }
        runTransaction(() =>
          registration.api.setStatus(matches[0].id, 'approved')
        )
        return {
          output: {
            canonical: readRecords(),
            headlessSupport: 'roadmap',
            matchedId: matches[0].id
          }
        }
      }
      throw new Error(`Unsupported retrieval action: ${actionId}`)
    },
    dispose: () => {
      registration?.dispose()
      stopReplay?.()
      if (core.hasSystemProperty(RETRIEVAL_KEY)) {
        core.unregisterSystemProperty(RETRIEVAL_KEY)
      }
    }
  })
}

const optionalCaseFactories = Object.freeze({
  'collaboration-two-actors': createCollaborationExecutor,
  'ai-registered-action': createAiExecutor,
  'machine-retrieval-action': createRetrievalExecutor
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
  const createExecutor =
    canonicalCaseFactories[definition.id] ??
    optionalCaseFactories[definition.id]
  if (!createExecutor) {
    throw new AtlasRuntimeUnavailableError(definition.id)
  }
  return createExecutor()
}

export const createAtlasRuntime = (caseId) =>
  createAtlasRuntimeHarness({ caseId, createExecutor: createAtlasCaseExecutor })
